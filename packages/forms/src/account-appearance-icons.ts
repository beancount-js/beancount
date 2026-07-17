import Banknote from "lucide-svelte/icons/banknote";
import Briefcase from "lucide-svelte/icons/briefcase";
import Building2 from "lucide-svelte/icons/building-2";
import Car from "lucide-svelte/icons/car";
import CircleDollarSign from "lucide-svelte/icons/circle-dollar-sign";
import CircleHelp from "lucide-svelte/icons/circle-help";
import CreditCard from "lucide-svelte/icons/credit-card";
import Dumbbell from "lucide-svelte/icons/dumbbell";
import Film from "lucide-svelte/icons/film";
import Gamepad2 from "lucide-svelte/icons/gamepad-2";
import Gift from "lucide-svelte/icons/gift";
import GraduationCap from "lucide-svelte/icons/graduation-cap";
import Heart from "lucide-svelte/icons/heart";
import House from "lucide-svelte/icons/house";
import Landmark from "lucide-svelte/icons/landmark";
import Music from "lucide-svelte/icons/music";
import PiggyBank from "lucide-svelte/icons/piggy-bank";
import Plane from "lucide-svelte/icons/plane";
import Receipt from "lucide-svelte/icons/receipt";
import Shield from "lucide-svelte/icons/shield";
import ShoppingCart from "lucide-svelte/icons/shopping-cart";
import Smartphone from "lucide-svelte/icons/smartphone";
import Store from "lucide-svelte/icons/store";
import Utensils from "lucide-svelte/icons/utensils";
import Wallet from "lucide-svelte/icons/wallet";

export const accountAppearanceIconOptions = [
  { value: "landmark", label: "Bank", icon: Landmark },
  { value: "wallet", label: "Wallet", icon: Wallet },
  { value: "house", label: "Home", icon: House },
  { value: "building-2", label: "Building", icon: Building2 },
  { value: "banknote", label: "Cash", icon: Banknote },
  { value: "credit-card", label: "Credit card", icon: CreditCard },
  { value: "circle-dollar-sign", label: "Money", icon: CircleDollarSign },
  { value: "piggy-bank", label: "Savings", icon: PiggyBank },
  { value: "shopping-cart", label: "Shopping", icon: ShoppingCart },
  { value: "utensils", label: "Dining", icon: Utensils },
  { value: "car", label: "Transport", icon: Car },
  { value: "plane", label: "Travel", icon: Plane },
  { value: "heart", label: "Health", icon: Heart },
  { value: "gift", label: "Gift", icon: Gift },
  { value: "gamepad-2", label: "Games", icon: Gamepad2 },
  { value: "music", label: "Music", icon: Music },
  { value: "film", label: "Entertainment", icon: Film },
  { value: "dumbbell", label: "Fitness", icon: Dumbbell },
  { value: "graduation-cap", label: "Education", icon: GraduationCap },
  { value: "briefcase", label: "Work", icon: Briefcase },
  { value: "receipt", label: "Bills", icon: Receipt },
  { value: "store", label: "Store", icon: Store },
  { value: "smartphone", label: "Phone", icon: Smartphone },
  { value: "shield", label: "Insurance", icon: Shield },
  { value: "circle-help", label: "Other", icon: CircleHelp },
] as const;
