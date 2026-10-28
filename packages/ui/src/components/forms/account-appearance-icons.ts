import { Activity } from "@lucide/svelte";
import { AirVent } from "@lucide/svelte";
import { Apple } from "@lucide/svelte";
import { BadgeDollarSign } from "@lucide/svelte";
import { BadgeEuro } from "@lucide/svelte";
import { BadgePoundSterling } from "@lucide/svelte";
import { Banknote } from "@lucide/svelte";
import { Bath } from "@lucide/svelte";
import { Baby } from "@lucide/svelte";
import { BedDouble } from "@lucide/svelte";
import { Beef } from "@lucide/svelte";
import { Beer } from "@lucide/svelte";
import { Bike } from "@lucide/svelte";
import { BookOpen } from "@lucide/svelte";
import { Briefcase } from "@lucide/svelte";
import { Building2 } from "@lucide/svelte";
import { BusFront } from "@lucide/svelte";
import { CakeSlice } from "@lucide/svelte";
import { Calculator } from "@lucide/svelte";
import { CalendarCheck } from "@lucide/svelte";
import { CalendarClock } from "@lucide/svelte";
import { CalendarDays } from "@lucide/svelte";
import { Car } from "@lucide/svelte";
import { CarFront } from "@lucide/svelte";
import { ChartNoAxesCombined } from "@lucide/svelte";
import { ChartPie } from "@lucide/svelte";
import { ChartSpline } from "@lucide/svelte";
import { CircleDollarSign } from "@lucide/svelte";
import { CircleHelp } from "@lucide/svelte";
import { CirclePercent } from "@lucide/svelte";
import { Coins } from "@lucide/svelte";
import { Coffee } from "@lucide/svelte";
import { CookingPot } from "@lucide/svelte";
import { CreditCard } from "@lucide/svelte";
import { Dumbbell } from "@lucide/svelte";
import { Film } from "@lucide/svelte";
import { FileChartColumnIncreasing } from "@lucide/svelte";
import { Flower2 } from "@lucide/svelte";
import { Fuel } from "@lucide/svelte";
import { Gamepad2 } from "@lucide/svelte";
import { Gem } from "@lucide/svelte";
import { Gift } from "@lucide/svelte";
import { GraduationCap } from "@lucide/svelte";
import { Hammer } from "@lucide/svelte";
import { HandCoins } from "@lucide/svelte";
import { Heart } from "@lucide/svelte";
import { HeartPulse } from "@lucide/svelte";
import { Hospital } from "@lucide/svelte";
import { House } from "@lucide/svelte";
import { IceCreamBowl } from "@lucide/svelte";
import { Keyboard } from "@lucide/svelte";
import { LampDesk } from "@lucide/svelte";
import { Landmark } from "@lucide/svelte";
import { Laptop } from "@lucide/svelte";
import { Leaf } from "@lucide/svelte";
import { LibraryBig } from "@lucide/svelte";
import { Lightbulb } from "@lucide/svelte";
import { Luggage } from "@lucide/svelte";
import { MapPinned } from "@lucide/svelte";
import { Martini } from "@lucide/svelte";
import { Milk } from "@lucide/svelte";
import { Monitor } from "@lucide/svelte";
import { MonitorSmartphone } from "@lucide/svelte";
import { Music } from "@lucide/svelte";
import { Navigation } from "@lucide/svelte";
import { NotebookPen } from "@lucide/svelte";
import { Package } from "@lucide/svelte";
import { Paintbrush } from "@lucide/svelte";
import { PawPrint } from "@lucide/svelte";
import { PiggyBank } from "@lucide/svelte";
import { Pill } from "@lucide/svelte";
import { Pizza } from "@lucide/svelte";
import { Plane } from "@lucide/svelte";
import { PlaneTakeoff } from "@lucide/svelte";
import { PlugZap } from "@lucide/svelte";
import { Refrigerator } from "@lucide/svelte";
import { Receipt } from "@lucide/svelte";
import { Salad } from "@lucide/svelte";
import { Sailboat } from "@lucide/svelte";
import { Sandwich } from "@lucide/svelte";
import { Scale } from "@lucide/svelte";
import { School } from "@lucide/svelte";
import { Shield } from "@lucide/svelte";
import { Shirt } from "@lucide/svelte";
import { ShowerHead } from "@lucide/svelte";
import { ShoppingBag } from "@lucide/svelte";
import { ShoppingBasket } from "@lucide/svelte";
import { ShoppingCart } from "@lucide/svelte";
import { Smartphone } from "@lucide/svelte";
import { Stethoscope } from "@lucide/svelte";
import { Store } from "@lucide/svelte";
import { Sun } from "@lucide/svelte";
import { Tag } from "@lucide/svelte";
import { Ticket } from "@lucide/svelte";
import { TrainFront } from "@lucide/svelte";
import { TrendingDown } from "@lucide/svelte";
import { TrendingUp } from "@lucide/svelte";
import { TvMinimal } from "@lucide/svelte";
import { Umbrella } from "@lucide/svelte";
import { Utensils } from "@lucide/svelte";
import { UtensilsCrossed } from "@lucide/svelte";
import { Vault } from "@lucide/svelte";
import { Wallet } from "@lucide/svelte";
import { WashingMachine } from "@lucide/svelte";
import { Wheat } from "@lucide/svelte";
import { Wine } from "@lucide/svelte";
import { Wrench } from "@lucide/svelte";

export const accountAppearanceIconOptions = [
  // Existing values stay stable because they are stored as account metadata.
  {
    value: "landmark",
    label: "Bank",
    category: "Money",
    keywords: ["banking", "institution", "account"],
    icon: Landmark,
  },
  {
    value: "wallet",
    label: "Wallet",
    category: "Money",
    keywords: ["cash", "purse", "spending"],
    icon: Wallet,
  },
  {
    value: "house",
    label: "Home",
    category: "Home & bills",
    keywords: ["rent", "mortgage", "household"],
    icon: House,
  },
  {
    value: "building-2",
    label: "Building",
    category: "Home & bills",
    keywords: ["property", "office", "utilities"],
    icon: Building2,
  },
  {
    value: "banknote",
    label: "Cash",
    category: "Money",
    keywords: ["notes", "money", "currency"],
    icon: Banknote,
  },
  {
    value: "credit-card",
    label: "Credit card",
    category: "Money",
    keywords: ["debt", "card", "payment"],
    icon: CreditCard,
  },
  {
    value: "circle-dollar-sign",
    label: "Money",
    category: "Money",
    keywords: ["currency", "dollar", "income"],
    icon: CircleDollarSign,
  },
  {
    value: "piggy-bank",
    label: "Savings",
    category: "Money",
    keywords: ["emergency fund", "piggy bank", "save"],
    icon: PiggyBank,
  },
  {
    value: "shopping-cart",
    label: "Shopping",
    category: "Shopping",
    keywords: ["groceries", "purchases", "retail"],
    icon: ShoppingCart,
  },
  {
    value: "utensils",
    label: "Dining",
    category: "Food & drink",
    keywords: ["restaurant", "meal", "food"],
    icon: Utensils,
  },
  {
    value: "car",
    label: "Transport",
    category: "Travel & transport",
    keywords: ["vehicle", "driving", "commute"],
    icon: Car,
  },
  {
    value: "plane",
    label: "Travel",
    category: "Travel & transport",
    keywords: ["flight", "holiday", "vacation"],
    icon: Plane,
  },
  {
    value: "heart",
    label: "Health",
    category: "Health & care",
    keywords: ["wellbeing", "medical", "care"],
    icon: Heart,
  },
  {
    value: "gift",
    label: "Gift",
    category: "Personal",
    keywords: ["present", "birthday", "donation"],
    icon: Gift,
  },
  {
    value: "gamepad-2",
    label: "Games",
    category: "Leisure",
    keywords: ["gaming", "console", "play"],
    icon: Gamepad2,
  },
  {
    value: "music",
    label: "Music",
    category: "Leisure",
    keywords: ["audio", "concert", "streaming"],
    icon: Music,
  },
  {
    value: "film",
    label: "Entertainment",
    category: "Leisure",
    keywords: ["cinema", "movie", "streaming"],
    icon: Film,
  },
  {
    value: "dumbbell",
    label: "Fitness",
    category: "Health & care",
    keywords: ["gym", "exercise", "sport"],
    icon: Dumbbell,
  },
  {
    value: "graduation-cap",
    label: "Education",
    category: "Work & learning",
    keywords: ["study", "course", "tuition"],
    icon: GraduationCap,
  },
  {
    value: "briefcase",
    label: "Work",
    category: "Work & learning",
    keywords: ["salary", "job", "career"],
    icon: Briefcase,
  },
  {
    value: "receipt",
    label: "Bills",
    category: "Home & bills",
    keywords: ["invoice", "statement", "payment"],
    icon: Receipt,
  },
  {
    value: "store",
    label: "Store",
    category: "Shopping",
    keywords: ["shop", "retail", "merchant"],
    icon: Store,
  },
  {
    value: "smartphone",
    label: "Phone",
    category: "Home & bills",
    keywords: ["mobile", "subscription", "telecom"],
    icon: Smartphone,
  },
  {
    value: "shield",
    label: "Insurance",
    category: "Home & bills",
    keywords: ["cover", "protection", "policy"],
    icon: Shield,
  },
  {
    value: "circle-help",
    label: "Other",
    category: "Personal",
    keywords: ["miscellaneous", "unknown", "general"],
    icon: CircleHelp,
  },

  {
    value: "badge-pound-sterling",
    label: "Pounds",
    category: "Money",
    keywords: ["GBP", "sterling", "currency"],
    icon: BadgePoundSterling,
  },
  {
    value: "badge-euro",
    label: "Euros",
    category: "Money",
    keywords: ["EUR", "euro", "currency"],
    icon: BadgeEuro,
  },
  {
    value: "badge-dollar-sign",
    label: "Dollars",
    category: "Money",
    keywords: ["USD", "dollar", "currency"],
    icon: BadgeDollarSign,
  },
  {
    value: "coins",
    label: "Coins",
    category: "Money",
    keywords: ["cash", "change", "currency"],
    icon: Coins,
  },
  {
    value: "hand-coins",
    label: "Allowance",
    category: "Money",
    keywords: ["cash", "support", "pocket money"],
    icon: HandCoins,
  },
  {
    value: "calculator",
    label: "Calculator",
    category: "Money",
    keywords: ["maths", "totals", "budget"],
    icon: Calculator,
  },
  {
    value: "circle-percent",
    label: "Percentage",
    category: "Money",
    keywords: ["discount", "interest", "rate"],
    icon: CirclePercent,
  },
  {
    value: "vault",
    label: "Vault",
    category: "Money",
    keywords: ["safe", "secure", "savings"],
    icon: Vault,
  },
  {
    value: "chart-no-axes-combined",
    label: "Performance",
    category: "Money",
    keywords: ["portfolio", "investment", "analytics"],
    icon: ChartNoAxesCombined,
  },
  {
    value: "chart-pie",
    label: "Budget split",
    category: "Money",
    keywords: ["categories", "spending", "allocation"],
    icon: ChartPie,
  },
  {
    value: "chart-spline",
    label: "Trend",
    category: "Money",
    keywords: ["growth", "forecast", "analytics"],
    icon: ChartSpline,
  },
  {
    value: "file-chart-column-increasing",
    label: "Financial report",
    category: "Money",
    keywords: ["statement", "income", "report"],
    icon: FileChartColumnIncreasing,
  },
  {
    value: "trending-up",
    label: "Growth",
    category: "Money",
    keywords: ["income", "investment", "increase"],
    icon: TrendingUp,
  },
  {
    value: "trending-down",
    label: "Decline",
    category: "Money",
    keywords: ["expense", "loss", "decrease"],
    icon: TrendingDown,
  },
  {
    value: "scale",
    label: "Balance",
    category: "Money",
    keywords: ["tax", "legal", "equal"],
    icon: Scale,
  },

  {
    value: "calendar-days",
    label: "Schedule",
    category: "Home & bills",
    keywords: ["recurring", "due date", "monthly"],
    icon: CalendarDays,
  },
  {
    value: "calendar-clock",
    label: "Due date",
    category: "Home & bills",
    keywords: ["bill", "reminder", "scheduled"],
    icon: CalendarClock,
  },
  {
    value: "calendar-check",
    label: "Paid",
    category: "Home & bills",
    keywords: ["complete", "payment", "scheduled"],
    icon: CalendarCheck,
  },
  {
    value: "lamp-desk",
    label: "Lighting",
    category: "Home & bills",
    keywords: ["electricity", "home", "utility"],
    icon: LampDesk,
  },
  {
    value: "lightbulb",
    label: "Energy",
    category: "Home & bills",
    keywords: ["electricity", "utility", "power"],
    icon: Lightbulb,
  },
  {
    value: "plug-zap",
    label: "Power",
    category: "Home & bills",
    keywords: ["electricity", "charger", "utility"],
    icon: PlugZap,
  },
  {
    value: "refrigerator",
    label: "Appliances",
    category: "Home & bills",
    keywords: ["fridge", "kitchen", "home"],
    icon: Refrigerator,
  },
  {
    value: "washing-machine",
    label: "Laundry",
    category: "Home & bills",
    keywords: ["washing", "clothes", "household"],
    icon: WashingMachine,
  },
  {
    value: "tv-minimal",
    label: "Television",
    category: "Home & bills",
    keywords: ["TV", "streaming", "subscription"],
    icon: TvMinimal,
  },
  {
    value: "monitor-smartphone",
    label: "Digital services",
    category: "Home & bills",
    keywords: ["internet", "mobile", "subscription"],
    icon: MonitorSmartphone,
  },
  {
    value: "air-vent",
    label: "Heating",
    category: "Home & bills",
    keywords: ["air conditioning", "gas", "utility"],
    icon: AirVent,
  },
  {
    value: "hammer",
    label: "Repairs",
    category: "Home & bills",
    keywords: ["maintenance", "DIY", "home"],
    icon: Hammer,
  },
  {
    value: "wrench",
    label: "Maintenance",
    category: "Home & bills",
    keywords: ["repair", "service", "tools"],
    icon: Wrench,
  },
  {
    value: "paintbrush",
    label: "Decor",
    category: "Home & bills",
    keywords: ["renovation", "paint", "home"],
    icon: Paintbrush,
  },
  {
    value: "bed-double",
    label: "Bedroom",
    category: "Home & bills",
    keywords: ["furniture", "sleep", "home"],
    icon: BedDouble,
  },
  {
    value: "bath",
    label: "Bathroom",
    category: "Home & bills",
    keywords: ["toiletries", "water", "home"],
    icon: Bath,
  },
  {
    value: "shower-head",
    label: "Water",
    category: "Home & bills",
    keywords: ["utility", "bathroom", "water bill"],
    icon: ShowerHead,
  },

  {
    value: "utensils-crossed",
    label: "Restaurant",
    category: "Food & drink",
    keywords: ["dining", "meal", "eat out"],
    icon: UtensilsCrossed,
  },
  {
    value: "cooking-pot",
    label: "Cooking",
    category: "Food & drink",
    keywords: ["kitchen", "meal", "groceries"],
    icon: CookingPot,
  },
  {
    value: "coffee",
    label: "Coffee",
    category: "Food & drink",
    keywords: ["cafe", "drink", "breakfast"],
    icon: Coffee,
  },
  {
    value: "pizza",
    label: "Takeaway",
    category: "Food & drink",
    keywords: ["delivery", "restaurant", "fast food"],
    icon: Pizza,
  },
  {
    value: "beef",
    label: "Groceries",
    category: "Food & drink",
    keywords: ["food", "supermarket", "meat"],
    icon: Beef,
  },
  {
    value: "sandwich",
    label: "Lunch",
    category: "Food & drink",
    keywords: ["meal deal", "food", "work lunch"],
    icon: Sandwich,
  },
  {
    value: "salad",
    label: "Healthy food",
    category: "Food & drink",
    keywords: ["groceries", "vegetables", "meal"],
    icon: Salad,
  },
  {
    value: "milk",
    label: "Dairy",
    category: "Food & drink",
    keywords: ["groceries", "food", "supermarket"],
    icon: Milk,
  },
  {
    value: "wheat",
    label: "Bakery",
    category: "Food & drink",
    keywords: ["bread", "groceries", "food"],
    icon: Wheat,
  },
  {
    value: "apple",
    label: "Fresh food",
    category: "Food & drink",
    keywords: ["fruit", "groceries", "food"],
    icon: Apple,
  },
  {
    value: "cake-slice",
    label: "Treats",
    category: "Food & drink",
    keywords: ["dessert", "bakery", "celebration"],
    icon: CakeSlice,
  },
  {
    value: "ice-cream-bowl",
    label: "Dessert",
    category: "Food & drink",
    keywords: ["treat", "sweet", "food"],
    icon: IceCreamBowl,
  },
  {
    value: "wine",
    label: "Wine",
    category: "Food & drink",
    keywords: ["alcohol", "drinks", "bar"],
    icon: Wine,
  },
  {
    value: "beer",
    label: "Beer",
    category: "Food & drink",
    keywords: ["alcohol", "pub", "drinks"],
    icon: Beer,
  },
  {
    value: "martini",
    label: "Cocktails",
    category: "Food & drink",
    keywords: ["bar", "alcohol", "drinks"],
    icon: Martini,
  },

  {
    value: "shopping-basket",
    label: "Basket",
    category: "Shopping",
    keywords: ["groceries", "purchases", "retail"],
    icon: ShoppingBasket,
  },
  {
    value: "shopping-bag",
    label: "Shopping bag",
    category: "Shopping",
    keywords: ["retail", "purchases", "shop"],
    icon: ShoppingBag,
  },
  {
    value: "package",
    label: "Deliveries",
    category: "Shopping",
    keywords: ["parcel", "post", "orders"],
    icon: Package,
  },
  {
    value: "tag",
    label: "Discount",
    category: "Shopping",
    keywords: ["sale", "offer", "price"],
    icon: Tag,
  },
  {
    value: "shirt",
    label: "Clothing",
    category: "Shopping",
    keywords: ["fashion", "clothes", "apparel"],
    icon: Shirt,
  },
  {
    value: "gem",
    label: "Luxury",
    category: "Shopping",
    keywords: ["jewellery", "premium", "gift"],
    icon: Gem,
  },

  {
    value: "book-open",
    label: "Books",
    category: "Work & learning",
    keywords: ["reading", "study", "education"],
    icon: BookOpen,
  },
  {
    value: "library-big",
    label: "Library",
    category: "Work & learning",
    keywords: ["books", "learning", "study"],
    icon: LibraryBig,
  },
  {
    value: "notebook-pen",
    label: "Notes",
    category: "Work & learning",
    keywords: ["stationery", "study", "writing"],
    icon: NotebookPen,
  },
  {
    value: "school",
    label: "School",
    category: "Work & learning",
    keywords: ["education", "tuition", "children"],
    icon: School,
  },
  {
    value: "laptop",
    label: "Computer",
    category: "Work & learning",
    keywords: ["work", "technology", "equipment"],
    icon: Laptop,
  },
  {
    value: "monitor",
    label: "Office",
    category: "Work & learning",
    keywords: ["desk", "computer", "work"],
    icon: Monitor,
  },
  {
    value: "keyboard",
    label: "Keyboard",
    category: "Work & learning",
    keywords: ["computer", "technology", "office"],
    icon: Keyboard,
  },

  {
    value: "bus-front",
    label: "Bus",
    category: "Travel & transport",
    keywords: ["public transport", "commute", "travel"],
    icon: BusFront,
  },
  {
    value: "train-front",
    label: "Train",
    category: "Travel & transport",
    keywords: ["rail", "public transport", "commute"],
    icon: TrainFront,
  },
  {
    value: "bike",
    label: "Cycling",
    category: "Travel & transport",
    keywords: ["bicycle", "transport", "exercise"],
    icon: Bike,
  },
  {
    value: "car-front",
    label: "Car",
    category: "Travel & transport",
    keywords: ["vehicle", "driving", "transport"],
    icon: CarFront,
  },
  {
    value: "fuel",
    label: "Fuel",
    category: "Travel & transport",
    keywords: ["petrol", "gas", "car"],
    icon: Fuel,
  },
  {
    value: "ticket",
    label: "Tickets",
    category: "Travel & transport",
    keywords: ["event", "transport", "booking"],
    icon: Ticket,
  },
  {
    value: "map-pinned",
    label: "Maps",
    category: "Travel & transport",
    keywords: ["location", "journey", "travel"],
    icon: MapPinned,
  },
  {
    value: "navigation",
    label: "Navigation",
    category: "Travel & transport",
    keywords: ["route", "driving", "journey"],
    icon: Navigation,
  },
  {
    value: "sailboat",
    label: "Boat",
    category: "Travel & transport",
    keywords: ["ferry", "cruise", "travel"],
    icon: Sailboat,
  },
  {
    value: "plane-takeoff",
    label: "Flight",
    category: "Travel & transport",
    keywords: ["airport", "holiday", "airfare"],
    icon: PlaneTakeoff,
  },

  {
    value: "activity",
    label: "Activity",
    category: "Health & care",
    keywords: ["wellbeing", "exercise", "health"],
    icon: Activity,
  },
  {
    value: "heart-pulse",
    label: "Medical",
    category: "Health & care",
    keywords: ["healthcare", "doctor", "wellbeing"],
    icon: HeartPulse,
  },
  {
    value: "stethoscope",
    label: "Doctor",
    category: "Health & care",
    keywords: ["medical", "healthcare", "appointment"],
    icon: Stethoscope,
  },
  {
    value: "pill",
    label: "Pharmacy",
    category: "Health & care",
    keywords: ["medicine", "prescription", "medical"],
    icon: Pill,
  },
  {
    value: "hospital",
    label: "Hospital",
    category: "Health & care",
    keywords: ["medical", "healthcare", "emergency"],
    icon: Hospital,
  },

  {
    value: "baby",
    label: "Children",
    category: "Personal",
    keywords: ["childcare", "family", "baby"],
    icon: Baby,
  },
  {
    value: "paw-print",
    label: "Pets",
    category: "Personal",
    keywords: ["animal", "vet", "dog"],
    icon: PawPrint,
  },
  {
    value: "leaf",
    label: "Nature",
    category: "Personal",
    keywords: ["garden", "environment", "green"],
    icon: Leaf,
  },
  {
    value: "flower-2",
    label: "Flowers",
    category: "Personal",
    keywords: ["garden", "gift", "nature"],
    icon: Flower2,
  },
  {
    value: "sun",
    label: "Solar",
    category: "Home & bills",
    keywords: ["energy", "electricity", "utility"],
    icon: Sun,
  },
  {
    value: "umbrella",
    label: "Rainy day",
    category: "Personal",
    keywords: ["emergency fund", "weather", "insurance"],
    icon: Umbrella,
  },
] as const;

export type AccountAppearanceIconOption =
  (typeof accountAppearanceIconOptions)[number];
