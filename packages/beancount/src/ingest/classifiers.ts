import * as tf from "@tensorflow/tfjs";
import * as stopwords from "stopword"; // For stopword removal
import { stemmer } from "stemmer"; // For stemming

export interface ClassifierOutput {
  category: string;
  probability: number;
}

export interface ClassifierInput {
  description: string;
  category: string;
}

export interface Classifier {
  classify: (description: string, topN: number) => ClassifierOutput[];
}

function preprocessText(description: string): string[] {
  const words = description
    .toLowerCase()
    .replaceAll(/[^a-zA-Z ]+/g, "")
    .split(/\s+/)
    .map((it) => it.trim())
    .filter((it) => it.length > 0);
  const filteredWords = stopwords.removeStopwords(words);
  return filteredWords.map((word) => stemmer(word));
}

export class TensorClassifier implements Classifier {
  private model: tf.LayersModel | null = null;
  private vocabulary: { [word: string]: number } = {};
  private categories: string[] = [];
  private nextWordId: number = 0;

  constructor(categories: string[]) {
    this.categories = categories;
  }

  // Build the vocabulary from training data
  private buildVocabulary(transactions: { description: string }[]): void {
    transactions.forEach((transaction) => {
      const tokens = preprocessText(transaction.description);
      tokens.forEach((token) => {
        if (!(token in this.vocabulary)) {
          this.vocabulary[token] = this.nextWordId++;
        }
      });
    });
  }

  // Convert text description to one-hot encoded input
  private oneHotEncode(description: string): number[] {
    const words = preprocessText(description);
    const vector = new Array(this.nextWordId).fill(0);
    words.forEach((word) => {
      if (word in this.vocabulary) {
        vector[this.vocabulary[word]] = 1;
      }
    });
    return vector;
  }

  // Create a neural network model
  private createModel(numCategories: number): tf.LayersModel {
    const model = tf.sequential();
    model.add(
      tf.layers.dense({
        inputShape: [this.nextWordId], // Input shape based on vocabulary size
        units: 10,
        activation: "relu",
      }),
    );
    model.add(
      tf.layers.dense({
        units: numCategories,
        activation: "softmax",
      }),
    );
    model.compile({
      optimizer: "adam",
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"],
    });
    return model;
  }

  // Train the model with transaction data
  public async train(transactions: ClassifierInput[]): Promise<void> {
    this.buildVocabulary(transactions);
    if (!this.model) {
      this.model = this.createModel(this.categories.length);
    }
    const inputs = transactions.map(({ description }) =>
      this.oneHotEncode(description),
    );
    const labels = transactions.map(({ category }) => {
      const label = new Array(this.categories.length).fill(0);
      label[this.categories.indexOf(category)] = 1;
      return label;
    });

    const xs = tf.tensor2d(inputs);
    const ys = tf.tensor2d(labels);

    await this.model.fit(xs, ys, {
      epochs: 100,
      shuffle: true,
    });
    console.log("classifier:tensor: training complete");
  }

  // Classify a new transaction description and return the top N matches
  public classify(description: string, topN: number): ClassifierOutput[] {
    if (!this.model) {
      throw new Error("Model has not been trained yet.");
    }

    const input = tf.tensor2d([this.oneHotEncode(description)]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const probabilities = prediction.dataSync();

    const topMatches = Array.from(probabilities)
      .map((prob, index) => ({
        category: this.categories[index],
        probability: prob,
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, topN);

    return topMatches;
  }

  // Update categories by extending the existing model
  public async extendCategories(newCategories: string[]): Promise<void> {
    const newCategorySet = new Set([...this.categories, ...newCategories]);
    const updatedCategories = Array.from(newCategorySet);

    // If new categories are added, extend the model
    if (updatedCategories.length > this.categories.length) {
      const newNumCategories = updatedCategories.length;

      // Extract the trained weights from the previous model
      const oldWeights = this.model?.getWeights() ?? [];

      // Create a new model with updated category count
      const newModel = this.createModel(newNumCategories);

      // Copy weights for the layers before the output layer
      newModel.layers[0].setWeights(oldWeights.slice(0, -2)); // Copy hidden layers
      const lastLayerWeights = oldWeights[oldWeights.length - 2];
      const lastLayerBiases = oldWeights[oldWeights.length - 1];

      // Extend the output layer weights to match the new number of categories
      const extendedLastLayerWeights = tf.concat(
        [
          lastLayerWeights,
          tf.randomNormal([
            lastLayerWeights.shape[0],
            newNumCategories - this.categories.length,
          ]),
        ],
        1,
      );

      const extendedLastLayerBiases = tf.concat([
        lastLayerBiases,
        tf.zeros([newNumCategories - this.categories.length]),
      ]);

      // Set the new weights for the output layer
      newModel.layers[1].setWeights([
        extendedLastLayerWeights,
        extendedLastLayerBiases,
      ]);

      // Update the internal model and categories
      this.model = newModel;
    }

    this.categories = updatedCategories;
  }

  // Return the state of the classifier for saving/loading
  public getState(): any {
    return {
      modelWeights: this.model
        ? this.model.getWeights().map((w) => w.arraySync())
        : [],
      vocabulary: this.vocabulary,
      categories: this.categories,
    };
  }

  // Initialize the classifier state from an object
  public async loadState(state: any): Promise<void> {
    this.vocabulary = state.vocabulary;
    this.categories = state.categories;
    if (state.modelWeights) {
      this.model = this.createModel(this.categories.length);
      const weights = state.modelWeights.map(
        (
          w:
            | string
            | number
            | boolean
            | tf.TypedArray
            | Uint8Array[]
            | tf.RecursiveArray<number | number[] | tf.TypedArray>
            | tf.RecursiveArray<boolean>
            | tf.RecursiveArray<string>
            | tf.WebGLData
            | tf.WebGPUData,
        ) => tf.tensor(w),
      );
      this.model.setWeights(weights);
      this.model.save;
    }
  }
}
