import { Amount } from "./amount";
import { Posting } from "./data";
import { Cost, Position } from "./position";

export function getWeight(pos: Posting | Position) {
  const units = pos.units,
    cost = pos.cost;
  let weight: Amount = new Amount("0");
  if (!units) {
    return weight;
  }

  if (cost instanceof Cost) {
    if (cost.amount) {
      weight = cost.amount.mul(units.number);
    }
  } else {
    weight = units;
    if (pos instanceof Posting && pos.price) {
      weight = pos.price.mul(units.number);
    }
  }
  return weight;
}
