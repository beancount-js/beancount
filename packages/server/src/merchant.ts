import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import YAML from "yaml";
import {
  normalizeMerchant,
  type MerchantAlias,
  type MerchantBrandData,
  type MerchantCandidate,
  type MerchantIdentity,
  type MerchantProvenance,
  type MerchantResolution,
} from "@beancount-js/beangulp";
import { projectIngestionRoot } from "./paths";

const PROFILE_VERSION = 1;

export type ProjectRootResolver = (
  projectId: string,
) => string | Promise<string>;

interface MerchantProfile {
  merchant: MerchantIdentity;
  notes: string;
}

interface MerchantEvent {
  version: 1;
  type: "confirmed" | "corrected" | "rejected" | "cleared-suppression";
  at: string;
  sourceId?: string;
  rawLabel?: string;
  normalizedLabel?: string;
  merchantId?: string;
}

interface MerchantIndex {
  version: 1;
  aliases: Record<string, string>;
  domains: Record<string, string>;
  suppressions: string[];
}

export interface ConfirmMerchantInput {
  sourceId: string;
  rawLabel: string;
  candidate: MerchantCandidate;
  targetMerchantId?: string;
  overwriteDetails?: boolean;
}

export interface UpdateMerchantInput {
  canonicalName?: string;
  domain?: string;
  description?: string;
  industry?: string;
  countryCode?: string;
  notes?: string;
}

export type MerchantProfileDetails = MerchantIdentity & {
  notes: string;
};

function safeProject(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value))
    throw new Error("Invalid project identifier.");
  return value;
}

function safeMerchantId(value: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(value))
    throw new Error("Invalid merchant identifier.");
  return value;
}

function now() {
  return new Date().toISOString();
}

function validDomain(value: string | undefined) {
  if (!value || /[/:?#\s]/.test(value)) return undefined;
  const normalized = value.toLowerCase().replace(/\.$/, "");
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
    normalized,
  )
    ? normalized
    : undefined;
}

function value(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function values(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function timestamp(input: unknown, fallback = now()) {
  const candidate = value(input);
  return candidate && Number.isFinite(Date.parse(candidate))
    ? candidate
    : fallback;
}

function parseProvenance(input: unknown): MerchantProvenance[] {
  const sources = new Set(["source", "alias", "ai", "brandfetch", "manual"]);
  return values(input).flatMap((item) => {
    const entry = record(item);
    const source = value(entry.source);
    if (!source || !sources.has(source)) return [];
    return [
      {
        source: source as MerchantProvenance["source"],
        provider: value(entry.provider),
        model: value(entry.model),
        version: value(entry.version),
        observedAt: timestamp(entry.observedAt),
      },
    ];
  });
}

function parseAliases(input: unknown): MerchantAlias[] {
  return values(input).flatMap((item) => {
    const entry = record(item);
    const raw = value(entry.value);
    const sourceId = value(entry.sourceId);
    const normalizedValue =
      value(entry.normalizedValue) ?? normalizeMerchant(raw);
    if (!raw || !sourceId || !normalizedValue) return [];
    return [
      {
        value: raw,
        sourceId,
        normalizedValue,
        confirmedAt: timestamp(entry.confirmedAt),
      },
    ];
  });
}

function parseBrand(input: unknown): MerchantBrandData | undefined {
  const entry = record(input);
  if (entry.provider !== "brandfetch") return undefined;
  const fetchedAt = value(entry.fetchedAt);
  if (!fetchedAt) return undefined;
  // A stale logo stays useful while the app refreshes it in the background.
  // Older profiles use `expiresAt` as their refresh deadline, so preserve it.
  const expiresAt = timestamp(entry.expiresAt, fetchedAt);
  const assetRecord = record(entry.asset);
  const filename = value(assetRecord.filename);
  const sha256 = value(assetRecord.sha256);
  const mediaType = value(assetRecord.mediaType);
  const parsedSize = Number(assetRecord.size);
  const size: 40 | 120 | undefined =
    parsedSize === 40 || parsedSize === 120
      ? (parsedSize as 40 | 120)
      : undefined;
  const asset =
    filename &&
    sha256 &&
    /^(image\/png|image\/jpeg|image\/webp)$/.test(mediaType ?? "") &&
    /^logo-[a-f0-9]{64}\.(png|jpg|webp)$/.test(filename)
      ? {
          filename,
          sha256,
          mediaType: mediaType as "image/png" | "image/jpeg" | "image/webp",
          expiresAt: timestamp(assetRecord.expiresAt, expiresAt),
          ...(size ? { size } : {}),
        }
      : undefined;
  return {
    provider: "brandfetch",
    brandId: value(entry.brandId),
    fetchedAt,
    expiresAt,
    asset,
  };
}

function parseBody(body: string) {
  const [descriptionPart, notesPart = ""] = body.split(/\n## Notes\s*\n/i, 2);
  const description = descriptionPart
    .replace(/^\s*## Description\s*\n/i, "")
    .trim();
  return { description: description || undefined, notes: notesPart.trim() };
}

function renderProfile(profile: MerchantProfile) {
  const { merchant, notes } = profile;
  const frontmatter = {
    version: PROFILE_VERSION,
    merchantId: merchant.merchantId,
    canonicalName: merchant.canonicalName,
    domain: merchant.domain,
    industry: merchant.industry,
    countryCode: merchant.countryCode,
    aliases: merchant.aliases,
    provenance: merchant.provenance,
    brand: merchant.brand,
  };
  const description = merchant.description?.trim() ?? "";
  return `---\n${YAML.stringify(frontmatter).trimEnd()}\n---\n\n## Description\n\n${description}\n\n## Notes\n\n${notes.trim()}\n`;
}

function parseProfile(contents: string): MerchantProfile {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/u.exec(contents);
  if (!match) throw new Error("Merchant profile is missing YAML frontmatter.");
  const frontmatter = record(YAML.parse(match[1]));
  if (frontmatter.version !== PROFILE_VERSION)
    throw new Error("Merchant profile schema version is unsupported.");
  const merchantId = value(frontmatter.merchantId);
  const canonicalName = value(frontmatter.canonicalName);
  if (!merchantId || !canonicalName)
    throw new Error("Merchant profile is incomplete.");
  safeMerchantId(merchantId);
  const body = parseBody(match[2]);
  return {
    merchant: {
      merchantId,
      canonicalName,
      aliases: parseAliases(frontmatter.aliases),
      domain: validDomain(value(frontmatter.domain)),
      description: body.description,
      industry: value(frontmatter.industry),
      countryCode: value(frontmatter.countryCode)?.toUpperCase(),
      provenance: parseProvenance(frontmatter.provenance),
      brand: parseBrand(frontmatter.brand),
    },
    notes: body.notes,
  };
}

function aliasKey(sourceId: string, normalizedLabel: string) {
  return `${sourceId}\u0000${normalizedLabel}`;
}

function suppressionKey(sourceId: string, normalizedLabel: string) {
  return aliasKey(sourceId, normalizedLabel);
}

/**
 * App-local, Markdown-backed merchant knowledge. Profiles are authoritative;
 * the generated JSON index only speeds up lookup and can be rebuilt at any time.
 */
export class FilesystemMerchantStore {
  private readonly locks = new Map<string, Promise<void>>();

  constructor(private readonly resolveProjectRoot: ProjectRootResolver) {}

  private async root(project: string) {
    const projectRoot = await this.resolveProjectRoot(safeProject(project));
    return join(projectIngestionRoot(projectRoot), "merchants");
  }

  private async profilePath(project: string, merchantId: string) {
    return join(
      await this.root(project),
      safeMerchantId(merchantId),
      "profile.md",
    );
  }

  private async eventsPath(project: string) {
    return join(await this.root(project), "merchant-events.jsonl");
  }

  private async indexPath(project: string) {
    return join(await this.root(project), "index.json");
  }

  private async withLock<T>(project: string, work: () => Promise<T>) {
    const previous = this.locks.get(project) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(project, current);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.locks.get(project) === current) this.locks.delete(project);
    }
  }

  private async write(path: string, contents: string | Uint8Array) {
    await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, contents, { mode: 0o600 });
    await fs.chmod(temporary, 0o600);
    await fs.rename(temporary, path);
  }

  private async readEvents(project: string): Promise<MerchantEvent[]> {
    try {
      const contents = await fs.readFile(
        await this.eventsPath(project),
        "utf8",
      );
      return contents
        .split("\n")
        .filter(Boolean)
        .flatMap((line) => {
          try {
            const event = JSON.parse(line) as MerchantEvent;
            return event.version === 1 && typeof event.type === "string"
              ? [event]
              : [];
          } catch {
            return [];
          }
        });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async appendEvent(project: string, event: MerchantEvent) {
    const path = await this.eventsPath(project);
    await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await fs.appendFile(path, `${JSON.stringify(event)}\n`, { mode: 0o600 });
    await fs.chmod(path, 0o600);
  }

  private async readProfile(project: string, merchantId: string) {
    const contents = await fs.readFile(
      await this.profilePath(project, merchantId),
      "utf8",
    );
    return parseProfile(contents);
  }

  private async writeProfile(project: string, profile: MerchantProfile) {
    await this.write(
      await this.profilePath(project, profile.merchant.merchantId),
      renderProfile(profile),
    );
  }

  private async profiles(project: string) {
    try {
      const entries = await fs.readdir(await this.root(project), {
        withFileTypes: true,
      });
      const profiles: MerchantProfile[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory() || !/^[a-zA-Z0-9-]+$/.test(entry.name))
          continue;
        try {
          profiles.push(await this.readProfile(project, entry.name));
        } catch {
          // A manually broken profile must not block importing unrelated work.
        }
      }
      return profiles;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async suppressions(project: string) {
    const state = new Set<string>();
    for (const event of await this.readEvents(project)) {
      if (!event.sourceId || !event.normalizedLabel) continue;
      const key = suppressionKey(event.sourceId, event.normalizedLabel);
      if (event.type === "rejected") state.add(key);
      if (event.type === "cleared-suppression" || event.type === "confirmed")
        state.delete(key);
    }
    return state;
  }

  private async rebuildIndex(project: string) {
    const aliases: Record<string, string> = {};
    const domains: Record<string, string> = {};
    for (const profile of await this.profiles(project)) {
      for (const alias of profile.merchant.aliases)
        aliases[aliasKey(alias.sourceId, alias.normalizedValue)] =
          profile.merchant.merchantId;
      if (profile.merchant.domain)
        domains[profile.merchant.domain] = profile.merchant.merchantId;
    }
    const index: MerchantIndex = {
      version: 1,
      aliases,
      domains,
      suppressions: [...(await this.suppressions(project))].sort(),
    };
    await this.write(
      await this.indexPath(project),
      `${JSON.stringify(index, null, 2)}\n`,
    );
  }

  async list(project: string) {
    return (await this.profiles(project))
      .map((profile) => profile.merchant)
      .sort((left, right) =>
        left.canonicalName.localeCompare(right.canonicalName),
      );
  }

  async get(project: string, merchantId: string) {
    return (await this.readProfile(project, merchantId)).merchant;
  }

  async getDetails(
    project: string,
    merchantId: string,
  ): Promise<MerchantProfileDetails> {
    const profile = await this.readProfile(project, merchantId);
    return { ...profile.merchant, notes: profile.notes };
  }

  async findByDomain(project: string, domain: string) {
    const normalized = validDomain(domain);
    if (!normalized) return undefined;
    return (await this.list(project)).find(
      (merchant) => merchant.domain === normalized,
    );
  }

  /** Remove a merchant profile directory and rebuild the catalog index. */
  async delete(project: string, merchantId: string) {
    await this.withLock(project, async () => {
      const directory = join(
        await this.root(project),
        safeMerchantId(merchantId),
      );
      await fs.rm(directory, { recursive: true, force: true });
      await this.rebuildIndex(project);
    });
  }

  async resolve(project: string, sourceId: string, rawLabel: string) {
    const normalizedLabel = normalizeMerchant(rawLabel);
    if (!normalizedLabel) return undefined;
    if (
      (await this.suppressions(project)).has(
        suppressionKey(sourceId, normalizedLabel),
      )
    ) {
      return {
        status: "suppressed",
        rawLabel,
        explanation:
          "Merchant enrichment was previously dismissed for this source label.",
      } satisfies MerchantResolution;
    }
    const merchant = (await this.list(project)).find((candidate) =>
      candidate.aliases.some(
        (alias) =>
          alias.sourceId === sourceId &&
          alias.normalizedValue === normalizedLabel,
      ),
    );
    if (!merchant) return undefined;
    return {
      status: "confirmed",
      rawLabel,
      merchant: {
        ...merchant,
        provenance: [
          ...merchant.provenance,
          { source: "alias", observedAt: now() },
        ],
      },
      explanation: `Matched confirmed merchant ${merchant.canonicalName} using a source-specific alias.`,
    } satisfies MerchantResolution;
  }

  async confirm(project: string, input: ConfirmMerchantInput) {
    const normalizedLabel = normalizeMerchant(input.rawLabel);
    if (!normalizedLabel) throw new Error("A merchant label is required.");
    if (!input.candidate.canonicalName.trim())
      throw new Error("A merchant name is required.");
    return this.withLock(project, async () => {
      const timestamp = now();
      let profile: MerchantProfile;
      if (input.targetMerchantId) {
        profile = await this.readProfile(project, input.targetMerchantId);
      } else {
        profile = {
          merchant: {
            merchantId: randomUUID(),
            canonicalName: input.candidate.canonicalName.trim(),
            aliases: [],
            domain: validDomain(input.candidate.domain),
            description: input.candidate.description,
            industry: input.candidate.industry,
            countryCode: input.candidate.countryCode?.toUpperCase(),
            provenance: [],
            brand: input.candidate.brand,
          },
          notes: "",
        };
      }
      const merchant = profile.merchant;
      if (input.overwriteDetails) {
        merchant.canonicalName = input.candidate.canonicalName.trim();
        merchant.domain = validDomain(input.candidate.domain);
        merchant.description = input.candidate.description;
        merchant.industry = input.candidate.industry;
        merchant.countryCode = input.candidate.countryCode?.toUpperCase();
      } else {
        merchant.domain ??= validDomain(input.candidate.domain);
        merchant.description ??= input.candidate.description;
        merchant.industry ??= input.candidate.industry;
        merchant.countryCode ??= input.candidate.countryCode?.toUpperCase();
      }
      if (
        input.candidate.brand &&
        Date.parse(input.candidate.brand.expiresAt) > Date.now()
      )
        merchant.brand = input.candidate.brand;
      if (
        !merchant.aliases.some(
          (alias) =>
            alias.sourceId === input.sourceId &&
            alias.normalizedValue === normalizedLabel,
        )
      ) {
        merchant.aliases = [
          ...merchant.aliases,
          {
            value: input.rawLabel,
            normalizedValue: normalizedLabel,
            sourceId: input.sourceId,
            confirmedAt: timestamp,
          },
        ];
      }
      merchant.provenance = [
        ...merchant.provenance,
        ...input.candidate.provenance,
        { source: "manual", observedAt: timestamp },
      ];
      await this.writeProfile(project, profile);
      await this.appendEvent(project, {
        version: 1,
        type: input.overwriteDetails ? "corrected" : "confirmed",
        at: timestamp,
        sourceId: input.sourceId,
        rawLabel: input.rawLabel,
        normalizedLabel,
        merchantId: merchant.merchantId,
      });
      await this.rebuildIndex(project);
      return merchant;
    });
  }

  /**
   * Direct catalog edit for a persisted merchant profile (no proposal context).
   * Empty optional strings clear those fields; invalid domains are rejected.
   */
  async update(
    project: string,
    merchantId: string,
    input: UpdateMerchantInput,
  ): Promise<MerchantProfileDetails> {
    return this.withLock(project, async () => {
      const profile = await this.readProfile(project, merchantId);
      const merchant = profile.merchant;
      const timestamp = now();

      if (input.canonicalName !== undefined) {
        const canonicalName = input.canonicalName.trim();
        if (!canonicalName) throw new Error("A merchant name is required.");
        merchant.canonicalName = canonicalName;
      }

      if (input.domain !== undefined) {
        const raw = input.domain.trim();
        if (!raw) {
          merchant.domain = undefined;
        } else {
          const domain = validDomain(raw);
          if (!domain) throw new Error("Enter a valid domain hostname.");
          merchant.domain = domain;
        }
      }

      if (input.description !== undefined) {
        merchant.description = value(input.description);
      }
      if (input.industry !== undefined) {
        merchant.industry = value(input.industry);
      }
      if (input.countryCode !== undefined) {
        merchant.countryCode = value(input.countryCode)?.toUpperCase();
      }
      if (input.notes !== undefined) {
        profile.notes = input.notes;
      }

      merchant.provenance = [
        ...merchant.provenance,
        { source: "manual", observedAt: timestamp },
      ];

      await this.writeProfile(project, profile);
      await this.appendEvent(project, {
        version: 1,
        type: "corrected",
        at: timestamp,
        merchantId: merchant.merchantId,
      });
      await this.rebuildIndex(project);
      return { ...merchant, notes: profile.notes };
    });
  }

  async suppress(project: string, sourceId: string, rawLabel: string) {
    const normalizedLabel = normalizeMerchant(rawLabel);
    if (!normalizedLabel) throw new Error("A merchant label is required.");
    await this.withLock(project, async () => {
      await this.appendEvent(project, {
        version: 1,
        type: "rejected",
        at: now(),
        sourceId,
        rawLabel,
        normalizedLabel,
      });
      await this.rebuildIndex(project);
    });
  }

  async clearSuppression(project: string, sourceId: string, rawLabel: string) {
    const normalizedLabel = normalizeMerchant(rawLabel);
    if (!normalizedLabel) throw new Error("A merchant label is required.");
    await this.withLock(project, async () => {
      await this.appendEvent(project, {
        version: 1,
        type: "cleared-suppression",
        at: now(),
        sourceId,
        rawLabel,
        normalizedLabel,
      });
      await this.rebuildIndex(project);
    });
  }

  async refresh(
    project: string,
    merchantId: string,
    candidate: MerchantCandidate,
  ) {
    return this.withLock(project, async () => {
      const profile = await this.readProfile(project, merchantId);
      profile.merchant.domain ??= validDomain(candidate.domain);
      profile.merchant.description ??= candidate.description;
      profile.merchant.industry ??= candidate.industry;
      profile.merchant.countryCode ??= candidate.countryCode?.toUpperCase();
      if (candidate.brand && Date.parse(candidate.brand.expiresAt) > Date.now())
        profile.merchant.brand = candidate.brand;
      profile.merchant.provenance = [
        ...profile.merchant.provenance,
        ...candidate.provenance,
      ];
      await this.writeProfile(project, profile);
      await this.rebuildIndex(project);
      return profile.merchant;
    });
  }

  /** Persist a validated Logo API image beside its merchant profile. */
  async cacheLogo(
    project: string,
    merchantId: string,
    asset: {
      bytes: Uint8Array;
      mediaType: "image/png" | "image/jpeg" | "image/webp";
      extension: "png" | "jpg" | "webp";
      sha256: string;
      size: 40 | 120;
      expiresAt: string;
    },
  ) {
    return this.withLock(project, async () => {
      const profile = await this.readProfile(project, merchantId);
      const directory = dirname(await this.profilePath(project, merchantId));
      const filename = `logo-${asset.sha256}.${asset.extension}`;
      const previousFilename = profile.merchant.brand?.asset?.filename;
      await this.write(join(directory, filename), asset.bytes);
      const fetchedAt = now();
      profile.merchant.brand = {
        provider: "brandfetch",
        brandId: profile.merchant.brand?.brandId,
        fetchedAt,
        expiresAt: asset.expiresAt,
        asset: {
          filename,
          mediaType: asset.mediaType,
          sha256: asset.sha256,
          size: asset.size,
          expiresAt: asset.expiresAt,
        },
      };
      await this.writeProfile(project, profile);
      if (previousFilename && previousFilename !== filename) {
        await fs.rm(join(directory, previousFilename), { force: true });
      }
      return profile.merchant;
    });
  }

  async logo(project: string, merchantId: string) {
    const merchant = await this.get(project, merchantId);
    const asset = merchant.brand?.asset;
    if (!asset) return undefined;
    const path = join(
      dirname(await this.profilePath(project, merchantId)),
      asset.filename,
    );
    try {
      return {
        bytes: await fs.readFile(path),
        mediaType: asset.mediaType,
        sha256: asset.sha256,
        size: asset.size,
        expiresAt: asset.expiresAt,
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
}
