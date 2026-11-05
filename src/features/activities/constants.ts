export const CATEGORIES = {
  MANGER: ["Ptit-dej", "Brunch", "Dej", "Goûter", "Dîner"],
  TRAVAIL: ["Job", "Formation", "Création"],
  DOMESTIQUE: ["Courses", "Administration", "Ménage", "Préparation", "Transport","Autre"],
  LOISIR: ["Jouer", "Lire", "Regarder", "Sortir", "Écouter", "Sport"],
  REPOS: ["Dormir", "Douche", "Trainer", "Autre"],
  FAMILLE: ["Téléphone", "Discussion", "Événement", "Activité"],
} as const;

export type Category = keyof typeof CATEGORIES;
 
export type Subcategory<C extends Category = Category> = (typeof CATEGORIES)[C][number];

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as [Category, ...Category[]];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && Object.hasOwn(CATEGORIES, value);
}

export function isSubcategoryOf<C extends Category>(
  category: C,
  value: unknown,
): value is Subcategory<C> {
  return typeof value === "string" && (CATEGORIES[category] as readonly string[]).includes(value);
}

export function getSubcategories<C extends Category>(category: C): readonly Subcategory<C>[] {
  return CATEGORIES[category];
}
