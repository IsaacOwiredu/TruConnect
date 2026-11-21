const { ServiceCategory } = require('../models');

const DEFAULT_CATEGORIES = [
  ['Electricians', 'electricians', 'Electrical wiring, installations, and repairs', '⌁'],
  ['Plumbers', 'plumbers', 'Pipe installation, repairs, and water systems', '◉'],
  ['Carpenters', 'carpenters', 'Furniture, cabinetry, and woodwork', '⌂'],
  ['Painters', 'painters', 'Interior and exterior painting', '▧'],
  ['Mechanics', 'mechanics', 'Vehicle servicing and repairs', '↗'],
  ['Tailors', 'tailors', 'Custom clothing and alterations', '✳'],
  ['Hairdressers and barbers', 'hairdressers-barbers', 'Hair styling, grooming, and barbering', '✂'],
  ['Welders', 'welders', 'Metal fabrication and welding', '⚒'],
  ['Refrigeration and AC technicians', 'refrigeration-ac', 'Cooling systems and air conditioning', '❄'],
  ['Cleaners', 'cleaners', 'Home and business cleaning', '✧'],
];

async function seedDefaultCategories() {
  await ServiceCategory.bulkWrite(DEFAULT_CATEGORIES.map(([name, slug, description, icon], sortOrder) => ({
    updateOne: {
      filter: { slug },
      update: { $setOnInsert: { name, slug, description, icon, sortOrder, isActive: true } },
      upsert: true,
    },
  })));
}

module.exports = { seedDefaultCategories };
