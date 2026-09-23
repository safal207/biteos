import { dishAvailable, dishPrice } from "./delivery.ts";
import type { ChoiceIntent, Dish, Restaurant } from "./delivery.ts";

export type ChoiceAnswers = {
  intent: ChoiceIntent;
  temperature: "hot" | "cold" | "any";
  taste: "sweet" | "neutral" | "savoury" | "any";
  partySize: "one" | "two" | "family";
  budget: number;
};

export type ChoicePick = {
  dish: Dish;
  quantity: number;
  unitPrice: number;
  price: number;
  reason: string;
};
export type ChoiceRecommendations = {
  best: ChoicePick | null;
  economy: ChoicePick | null;
  premium: ChoicePick | null;
};

const empty = (): ChoiceRecommendations => ({
  best: null,
  economy: null,
  premium: null,
});

function quantityFor(answers: ChoiceAnswers): number {
  if (answers.partySize === "family") return 3;
  return answers.partySize === "two" ? 2 : 1;
}

function totalPrice(
  restaurant: Restaurant,
  dish: Dish,
  answers: ChoiceAnswers,
) {
  return dishPrice(restaurant, dish) * quantityFor(answers);
}

function isEligible(
  restaurant: Restaurant,
  dish: Dish,
  answers: ChoiceAnswers,
) {
  const choice = dish.choice;
  if (
    !choice ||
    choice.sourceStatus !== "confirmed" ||
    !dishAvailable(restaurant, dish) ||
    !choice.intents.includes(answers.intent) ||
    (answers.temperature !== "any" &&
      choice.temperature !== answers.temperature) ||
    (answers.taste !== "any" && choice.taste !== answers.taste) ||
    !choice.partySizes.includes(answers.partySize) ||
    totalPrice(restaurant, dish, answers) > answers.budget
  )
    return false;

  return (
    !dish.components ||
    dish.components.every((id) => {
      const component = restaurant.dishes.find((item) => item.id === id);
      return component?.choice?.sourceStatus === "confirmed";
    })
  );
}

function score(dish: Dish, price: number, answers: ChoiceAnswers): number {
  // A confirmed pairing is more useful than one item for a cold coffee/dessert break.
  const pairing = dish.components ? 100 : 0;
  const exactTemperature = answers.temperature === "any" ? 0 : 10;
  const exactTaste = answers.taste === "any" ? 0 : 10;
  const budgetFit = Math.floor((price * 20) / answers.budget);
  return pairing + exactTemperature + exactTaste + budgetFit;
}

function pick(
  dish: Dish | undefined,
  restaurant: Restaurant,
  answers: ChoiceAnswers,
  role: "best" | "economy" | "premium",
): ChoicePick | null {
  if (!dish) return null;
  const quantity = quantityFor(answers);
  const unitPrice = dishPrice(restaurant, dish);
  const detail = dish.components
    ? quantity > 1
      ? `${quantity} сета: по 1 напитку и 1 десерту каждому · цена по исходному меню`
      : "1 напиток и 1 десерт; цена по исходному меню"
    : quantity > 1
      ? `${quantity} порции по цене за штуку`
      : "Подходит по вашим ответам и бюджету";
  const reason =
    role === "economy"
      ? `Более доступный вариант · ${detail}`
      : role === "premium"
        ? `Дополнительный вариант в пределах бюджета · ${detail}`
        : detail;
  return { dish, quantity, unitPrice, price: unitPrice * quantity, reason };
}

export function recommendRobys(
  restaurant: Restaurant,
  answers: ChoiceAnswers,
): ChoiceRecommendations {
  if (
    restaurant.id !== "robys-coffee-house" ||
    restaurant.currency !== "TRY" ||
    !restaurant.open ||
    !Number.isSafeInteger(answers.budget) ||
    answers.budget <= 0
  )
    return empty();

  const eligible = restaurant.dishes
    .filter((dish) => isEligible(restaurant, dish, answers))
    .sort(
      (left, right) =>
        score(right, totalPrice(restaurant, right, answers), answers) -
          score(left, totalPrice(restaurant, left, answers), answers) ||
        totalPrice(restaurant, left, answers) -
          totalPrice(restaurant, right, answers) ||
        left.id.localeCompare(right.id),
    );
  const best = eligible[0];
  if (!best) return empty();
  const bestPrice = totalPrice(restaurant, best, answers);
  const economy = eligible
    .filter((dish) => totalPrice(restaurant, dish, answers) < bestPrice)
    .sort(
      (left, right) =>
        totalPrice(restaurant, left, answers) -
          totalPrice(restaurant, right, answers) ||
        left.id.localeCompare(right.id),
    )[0];
  const premium = eligible.find(
    (dish) => totalPrice(restaurant, dish, answers) > bestPrice,
  );
  return {
    best: pick(best, restaurant, answers, "best"),
    economy: pick(economy, restaurant, answers, "economy"),
    premium: pick(premium, restaurant, answers, "premium"),
  };
}
