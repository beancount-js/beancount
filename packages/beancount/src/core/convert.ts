import { Amount } from "./amount";
import { Posting, resolveMissing } from "./data";
import { Cost, Position } from "./position";

export function getWeight(pos: Posting | Position) {
  const units = resolveMissing(pos.units)!,
    cost = resolveMissing(pos.cost);
  let weight: Amount = new Amount("0");

  if (cost instanceof Cost) {
    weight = resolveMissing(cost.amount)!.mul(units.number);
  } else {
    weight = units;
    if (pos instanceof Posting) {
      const price = resolveMissing(pos.price);
      if (price) {
        weight = price.mul(units.number);
      }
    }
  }
  return weight;
}
