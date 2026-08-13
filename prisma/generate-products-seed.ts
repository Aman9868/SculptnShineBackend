import fs from 'fs';
import path from 'path';

interface VariantInput {
  title: string;
  sku: string;
  flavor?: string;
  weight?: string;
  price: number;
  discountPrice?: number;
  stock: number;
  images: string[];
}

interface ProductInput {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  discountPrice?: number;
  sku: string;
  stock: number;
  lowStockAlert: number;
  images: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
  categoryId: string;
  subcategoryId: string;
  brandId: string;
  preference?: 'VEGETARIAN' | 'NON_VEGETARIAN' | 'EGGITARIAN' | 'VEGAN' | 'NOT_APPLICABLE';
  variants?: VariantInput[];
}

const categoriesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'categories-data.json'), 'utf-8'));
const brandsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'brands-data.json'), 'utf-8'));

// Helper map to locate subcategory and brand UUIDs
const brandMap: Record<string, string> = {};
brandsData.forEach((b: any) => {
  brandMap[b.slug] = b.id;
});

const categoryMap: Record<string, { id: string; subcategories: Record<string, string> }> = {};
categoriesData.forEach((c: any) => {
  const subMap: Record<string, string> = {};
  c.subcategories.forEach((s: any) => {
    subMap[s.slug] = s.id;
  });
  categoryMap[c.slug] = { id: c.id, subcategories: subMap };
});

const generateSlug = (title: string, index: number) => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + `-${index}`;
};

const products: ProductInput[] = [];
let globalIndex = 1;

// Image pools
const proteinImages = [
  "https://images.unsplash.com/photo-1593095940071-007d80173876?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
];

const skincareImages = [
  "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=800&q=80",
];

const haircareImages = [
  "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1608248597261-e4d044696386?auto=format&fit=crop&w=800&q=80",
];

const cosmeticsImages = [
  "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
];

const wellnessImages = [
  "https://images.unsplash.com/photo-1550572017-edd951aa8f72?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=800&q=80",
];

// Product Definition Templates per subcategory & brand
const templates = [
  // 1. Proteins & Fitness Supplements
  {
    cat: 'proteins-fitness-supplements',
    sub: 'whey-isolate-concentrates',
    brands: ['optimum-nutrition', 'muscleblaze', 'dymatize'],
    names: [
      'Gold Standard 100% Whey Protein Isolate',
      'Biozyme Performance Whey Protein',
      'ISO100 Hydrolyzed Protein Powder',
      'Raw Whey Protein Concentrate 80%',
      'Ultra Pure Isolate Zero Carb',
      'Whey Gold Fast Absorbing Formula',
      'Nitro Muscle Builder Whey',
      'Clean Whey Isolate Unflavored',
      'Triple Chocolate Whey Isolate',
      'Double Rich Chocolate Protein'
    ],
    prefs: ['VEGETARIAN', 'VEGAN', 'EGGITARIAN'],
    images: proteinImages,
    basePrice: 4500,
    hasVariants: true,
    flavors: ['Double Rich Chocolate', 'Vanilla Ice Cream', 'Extreme Milk Chocolate', 'Strawberries & Cream'],
    weights: ['1 kg (2.2 lbs)', '2 kg (4.4 lbs)', '5 lbs (2.27 kg)']
  },
  {
    cat: 'proteins-fitness-supplements',
    sub: 'plant-organic-protein',
    brands: ['wellbeing-nutrition', 'muscleblaze'],
    names: [
      'Superfood Plant Protein Enriched with Pea & Brown Rice',
      'Organic Vegan Pea Protein Blend',
      'Plant Protein Isolate Vanilla Superfood',
      'Raw Organic Plant Protein Unflavored',
      'Complete Vegan Protein Powder Chocolate',
      'Clean Green Plant Protein Shake',
      'Pea & Pumpkin Seed Organic Protein',
      'Dairy-Free Fitness Protein Blend',
      'Digestive Enzyme Infused Plant Protein',
      'Keto Vegan Plant Protein Formula'
    ],
    prefs: ['VEGAN'],
    images: proteinImages,
    basePrice: 2800,
    hasVariants: true,
    flavors: ['Rich Dark Chocolate', 'French Vanilla', 'Berry Blast', 'Matcha Green Tea'],
    weights: ['500g', '1 kg']
  },
  {
    cat: 'proteins-fitness-supplements',
    sub: 'bcaa-pre-workouts',
    brands: ['optimum-nutrition', 'muscleblaze', 'dymatize'],
    names: [
      'Essential Amino Energy Pre-Workout Booster',
      'WrathX Explosive Pre-Workout Powder',
      'BCAA 6000 Instantized Amino Acid Ratio 2:1:1',
      'Gold Standard Pre-Workout Nitric Oxide',
      'Intra-Workout Hydration BCAA Electrolyte',
      'Clean Energy Pre-Workout Caffeine Free',
      'Super Pump Pre-Workout Matrix',
      'Amino Endurance BCAA Powder',
      'Recovery BCAA Glutamine Drink Mix',
      'Extreme Nitric Oxide Pump Powder'
    ],
    prefs: ['VEGETARIAN', 'VEGAN'],
    images: proteinImages,
    basePrice: 1999,
    hasVariants: true,
    flavors: ['Green Apple', 'Blue Raspberry', 'Watermelon', 'Fruit Punch'],
    weights: ['300g (30 servings)', '600g (60 servings)']
  },
  {
    cat: 'proteins-fitness-supplements',
    sub: 'creatine-mass-gainers',
    brands: ['optimum-nutrition', 'muscleblaze'],
    names: [
      'Micronized Creatine Monohydrate 200 Mesh',
      'Super Mass Gainer High Calorie Formula',
      'Creatine HCL Ultra Pure Powder',
      'High Protein Lean Mass Gainer',
      'Creatine Monohydrate Creapure Quality',
      'Extreme Bulk Mass Gainer XXL',
      'Mass Gainer Complex 1000 Calories',
      'Creapure Micronized Muscle Powder',
      'Carbo Fuel Instant Energy Matrix',
      'Hardgainer Weight Gainer Formula'
    ],
    prefs: ['VEGETARIAN'],
    images: proteinImages,
    basePrice: 1299,
    hasVariants: false
  },

  // 2. Skincare & Facial Care
  {
    cat: 'skincare-facial-care',
    sub: 'face-serums-glow-elixirs',
    brands: ['the-ordinary', 'cerave', 'la-roche-posay'],
    names: [
      'Niacinamide 10% + Zinc 1% Blemish Serum',
      'Hyaluronic Acid 2% + B5 Hydration Serum',
      'Vitamin C 15% Brightening Glow Serum',
      'AHA 30% + BHA 2% Peeling Solution Serum',
      'Retinol 0.5% in Squalane Anti-Aging Elixir',
      'Salicylic Acid 2% Exfoliating Serum',
      'Alpha Arbutin 2% Dark Spot Corrector',
      'Skin Renewing Vitamin C Serum',
      'Effaclar Serum Salicylic & Glycolic Acid',
      'Pure Niacinamide 10 Anti-Dark Spot Serum'
    ],
    prefs: ['VEGAN', 'NOT_APPLICABLE'],
    images: skincareImages,
    basePrice: 850,
    hasVariants: true,
    flavors: [],
    weights: ['30 ml', '60 ml']
  },
  {
    cat: 'skincare-facial-care',
    sub: 'moisturizers-night-creams',
    brands: ['cerave', 'the-ordinary', 'la-roche-posay'],
    names: [
      'Moisturizing Cream with 3 Essential Ceramides',
      'Daily Moisturizing Lotion Oil-Free',
      'Natural Moisturizing Factors + HA Hydrator',
      'Toleriane Double Repair Face Moisturizer',
      'PM Facial Moisturizing Lotion Ultra Lightweight',
      'Skin Renewing Night Cream Peptides',
      'Hydro Boost Water Gel Hyaluronic Cream',
      'Barrier Repair Barrier Cream Centella',
      'Cicaplast Baume B5 Soothing Cream',
      'Gentle Skin Hydrating Face Cream'
    ],
    prefs: ['VEGAN', 'NOT_APPLICABLE'],
    images: skincareImages,
    basePrice: 1250,
    hasVariants: false
  },
  {
    cat: 'skincare-facial-care',
    sub: 'sunscreen-uv-protection',
    brands: ['la-roche-posay', 'cerave', 'the-ordinary'],
    names: [
      'Anthelios Melt-In Milk Sunscreen SPF 60',
      'Mineral Sunscreen Broad Spectrum SPF 50',
      'Oil-Free Gel Sunscreen SPF 50 PA++++',
      'Hydrating Mineral Sunscreen Sheer Tint SPF 30',
      'Anthelios Ultra Light Fluid SPF 50+',
      'Water Resistant Sports Sunscreen SPF 50',
      'Invisible Shield Gel Sunscreen SPF 50',
      'Matte Finish Sunscreen Fluid SPF 50',
      'Daily Facial Defence Sunscreen SPF 50',
      'UV Defend Light Lotion SPF 50'
    ],
    prefs: ['VEGAN', 'NOT_APPLICABLE'],
    images: skincareImages,
    basePrice: 1499,
    hasVariants: false
  },

  // 3. Salon & Haircare Excellence
  {
    cat: 'salon-haircare-excellence',
    sub: 'keratin-anti-frizz-shampoos',
    brands: ['loreal-professionnel', 'olaplex'],
    names: [
      'Absolut Repair Molecular Repair Shampoo',
      'No. 4 Bond Maintenance Smoothing Shampoo',
      'Professional Serie Expert Liss Unlimited Shampoo',
      'Keratin Smooth Anti-Frizz Hair Cleanser',
      'Pro Longer Lengths Renewing Shampoo',
      'Sulfate Free Keratin Moisture Shampoo',
      'No. 4C Bond Maintenance Clarifying Shampoo',
      'Mythic Oil Nourishing Argan Shampoo',
      'Scalp Advanced Anti-Dandruff Shampoo',
      'Inforcer Strengthening Biotin Shampoo'
    ],
    prefs: ['VEGAN', 'NOT_APPLICABLE'],
    images: haircareImages,
    basePrice: 1650,
    hasVariants: true,
    flavors: [],
    weights: ['250 ml', '500 ml', '1500 ml']
  },
  {
    cat: 'salon-haircare-excellence',
    sub: 'nourishing-scalp-oils-serums',
    brands: ['loreal-professionnel', 'olaplex'],
    names: [
      'No. 7 Bonding Hair Oil Thermal Heat Protectant',
      'Mythic Oil Rich Nourishing Serum',
      'Serie Expert Absolut Repair Oil 10-in-1',
      'No. 9 Bond Protector Hair Serum',
      'Rosemary Hair Growth Scalp Elixir',
      'Pure Argan Hair Repair Treatment Oil',
      'Scalp Density Serum Anti-Hairloss',
      'Anti-Frizz Smoothing Hair Serum',
      'Strengthening Keratin Leave-In Serum',
      'Shine Enhancing Hair Polish Serum'
    ],
    prefs: ['VEGAN', 'NOT_APPLICABLE'],
    images: haircareImages,
    basePrice: 1950,
    hasVariants: false
  },

  // 4. Beauty & Luxury Cosmetics
  {
    cat: 'beauty-luxury-cosmetics',
    sub: 'matte-lipsticks-gloss',
    brands: ['mac-cosmetics', 'maybelline-new-york'],
    names: [
      'Retro Matte Lipstick Ruby Woo Classic Red',
      'SuperStay Matte Ink Liquid Lipstick Longwear',
      'Matte Velvet Powder Kiss Lipstick',
      'Lifter Lip Gloss Hyaluronic Acid Plumping',
      'Sensational Liquid Matte Lip Color',
      'Powder Kiss Liquid Lipcolor Soft Matte',
      'SuperStay Vinyl Ink Longwear Liquid Lipcolor',
      'Lustreglass Sheer Shine Lipstick',
      'Ultimate Matte Crayon Lip Color',
      'Hyper Gloss Plumping Lip Oil'
    ],
    prefs: ['VEGAN', 'NOT_APPLICABLE'],
    images: cosmeticsImages,
    basePrice: 1100,
    hasVariants: true,
    flavors: [],
    weights: ['Shade: Ruby Red', 'Shade: Nude Pink', 'Shade: Warm Mocha', 'Shade: Berry Wine']
  },
  {
    cat: 'beauty-luxury-cosmetics',
    sub: 'foundations-concealers',
    brands: ['mac-cosmetics', 'maybelline-new-york'],
    names: [
      'Studio Fix Fluid SPF 15 24HR Foundation',
      'Fit Me Matte + Poreless Liquid Foundation',
      'Instant Age Rewind Eraser Multi-Use Concealer',
      'Studio Fix Every-Wear All-Over Face Pen',
      'SuperStay 30H Full Coverage Foundation',
      'Fit Me Concealer High Coverage Oil-Free',
      'Pro Longwear Concealer Water Resistant',
      'Luminous Glow Liquid Foundation SPF 20',
      'Skin Tint Light Coverage Serum Foundation',
      'Velvet Full Coverage Matte Concealer'
    ],
    prefs: ['VEGAN', 'NOT_APPLICABLE'],
    images: cosmeticsImages,
    basePrice: 1350,
    hasVariants: true,
    flavors: [],
    weights: ['NC15', 'NC20', 'NC25', 'NC30', 'NC35']
  },

  // 5. Wellness & Daily Health
  {
    cat: 'wellness-daily-health',
    sub: 'multivitamins-minerals',
    brands: ['wellbeing-nutrition'],
    names: [
      'Daily Multivitamin Melts Organic Plant Extracts',
      'Slow Multivitamin for Men 2-in-1 Tech',
      'Slow Multivitamin for Women 2-in-1 Tech',
      'Whole Food Multivitamin Gummy Berry Flavor',
      'Organic Vitamin C 1000mg Zinc Effervescent',
      'Vitamin D3 + K2 Bone Strength Capsules',
      'Active Hair Multivitamin Biotin & Keratin',
      'Stress Relief Ashwagandha Magnesium Tablet',
      'Gut Health Probiotics 50 Billion CFU',
      'Immunity Booster Zinc & Elderberry Melts'
    ],
    prefs: ['VEGETARIAN', 'VEGAN'],
    images: wellnessImages,
    basePrice: 890,
    hasVariants: false
  },
  {
    cat: 'wellness-daily-health',
    sub: 'omega-3-joint-support',
    brands: ['wellbeing-nutrition'],
    names: [
      'Triple Strength Omega-3 Fish Oil 1000mg EPA/DHA',
      'Vegan Omega 3 6 9 Algal Oil Capsules',
      'Wild Caught Deep Sea Fish Oil Softgels',
      'Joint Support Glucosamine Chondroitin Collagen',
      'Pure Hawaiian Astaxanthin Antioxidant',
      'Curcumin Collagen Joint Ease Capsules',
      'Krill Oil Phospholipid Omega-3 Matrix',
      'Zero Fishy Burp Omega-3 Lemon Softgel',
      'Heart Health Omega-3 CoQ10 Complex',
      'Advanced Joint Flexibility Repair Formula'
    ],
    prefs: ['NON_VEGETARIAN', 'VEGAN', 'VEGETARIAN'],
    images: wellnessImages,
    basePrice: 1190,
    hasVariants: false
  }
];

// Loop through templates to reach target 200 items
let count = 0;
let loopCounter = 0;

while (products.length < 200) {
  loopCounter++;
  for (const t of templates) {
    if (products.length >= 200) break;

    const catObj = categoryMap[t.cat];
    if (!catObj) continue;
    const subId = catObj.subcategories[t.sub];
    if (!subId) continue;

    const brandSlug = t.brands[(globalIndex + loopCounter) % t.brands.length];
    const brandId = brandMap[brandSlug];

    const baseName = t.names[(globalIndex) % t.names.length];
    const itemTitle = loopCounter === 1 ? baseName : `${baseName} Vol. ${loopCounter}`;
    const slug = generateSlug(itemTitle, globalIndex);
    const sku = `SKU-${t.cat.substring(0, 3).toUpperCase()}-${globalIndex.toString().padStart(4, '0')}`;
    const image = t.images[globalIndex % t.images.length];

    const price = t.basePrice + (globalIndex % 5) * 150;
    const discountPrice = Math.round(price * 0.85);
    const stock = 10 + (globalIndex * 7) % 90;
    const pref = t.prefs[globalIndex % t.prefs.length] as any;

    const product: ProductInput = {
      id: crypto.randomUUID(),
      title: itemTitle,
      slug: slug,
      description: `Premium quality ${itemTitle} manufactured by ${brandSlug}. Formulated for maximum effectiveness and superior results.`,
      price: price,
      discountPrice: discountPrice,
      sku: sku,
      stock: stock,
      lowStockAlert: 5,
      images: [image],
      status: stock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK',
      categoryId: catObj.id,
      subcategoryId: subId,
      brandId: brandId,
      preference: pref,
    };

    // Add variants for ~50% of items if template supports variants
    if (t.hasVariants && globalIndex % 2 === 0) {
      product.variants = [];
      const flavorList = t.flavors || [];
      const weightList = t.weights || [];

      if (flavorList.length > 0) {
        flavorList.slice(0, 3).forEach((flv, vIdx) => {
          const varPrice = price + vIdx * 200;
          product.variants!.push({
            title: `${itemTitle} - ${flv}`,
            sku: `${sku}-V${vIdx + 1}`,
            flavor: flv,
            weight: weightList[vIdx % weightList.length] || null,
            price: varPrice,
            discountPrice: Math.round(varPrice * 0.85),
            stock: stock + vIdx * 5,
            images: [image],
          });
        });
      } else if (weightList.length > 0) {
        weightList.slice(0, 3).forEach((wgt, vIdx) => {
          const varPrice = price + vIdx * 250;
          product.variants!.push({
            title: `${itemTitle} (${wgt})`,
            sku: `${sku}-W${vIdx + 1}`,
            weight: wgt,
            price: varPrice,
            discountPrice: Math.round(varPrice * 0.85),
            stock: stock + vIdx * 4,
            images: [image],
          });
        });
      }
    }

    products.push(product);
    globalIndex++;
  }
}

const outputPath = path.join(__dirname, 'products-data.json');
fs.writeFileSync(outputPath, JSON.stringify(products, null, 2), 'utf-8');

console.log(`✅ Generated ${products.length} products with variants in ${outputPath}`);
