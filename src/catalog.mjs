export const products = [
  {
    id: "surgeq-l5",
    slug: "surgeq-l5",
    code: "SL5",
    name: "SurgEQ-L5",
    price: 79,
    currency: "EUR",
    fileName: "SurgEQ-L5-macOS.zip",
    active: true,
  },
];

export function getProductBySlug(slug) {
  return products.find((product) => product.slug === slug && product.active);
}
