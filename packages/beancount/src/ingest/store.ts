import { readable, type Readable } from "svelte/store";
import {
  TensorClassifier,
  type Classifier,
  type ClassifierInput,
} from "./classifiers";
import dataset from "./train.json";

const NullClassifier: Classifier = {
  classify(description: string, topN: number) {
    return [];
  },
};

async function createClassifier(
  categories: Array<string>,
  data: ClassifierInput[],
  set: (value: Classifier) => void,
) {
  const tensor = new TensorClassifier(categories);
  await tensor.train(data);
  const classifier: Classifier = {
    classify(description: string, topN: number) {
      return tensor.classify(description, topN);
    },
  };
  set(classifier);
}

export function useClassifier(): Readable<Classifier> {
  const data: Record<string, Array<string>> = dataset;
  const categories = Object.keys(data) as Array<string>;

  return readable(NullClassifier, (set) => {
    const trainingData: ClassifierInput[] = categories.flatMap((category) => {
      const values = data[category] as Array<string>;
      return values.map((description) => ({ description, category }));
    });
    createClassifier(categories, trainingData, set);
  });
}
