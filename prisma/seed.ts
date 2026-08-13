import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

const prisma = new PrismaClient();

interface SubcategorySeedInput {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

interface CategorySeedInput {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  subcategories?: SubcategorySeedInput[];
}

async function seedAdminUser() {
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@sculptnshine.com';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'secureadminpassword123';

  console.log(`\n🔑 Checking Admin User (${adminEmail})...`);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(adminPassword, salt);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'ADMIN',
      profile: {
        create: {}
      }
    },
  });

  console.log(`✅ Admin user ready. ID: ${adminUser.id}`);
}

async function seedCategoriesAndSubcategories() {
  const jsonPath = path.join(__dirname, 'categories-data.json');
  if (!fs.existsSync(jsonPath)) {
    console.warn(`⚠️ Warning: Seed file not found at ${jsonPath}`);
    return;
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const categoriesData: CategorySeedInput[] = JSON.parse(rawData);

  console.log(`\n📦 Seeding ${categoriesData.length} Product Categories & Subcategories...`);

  let createdCategoriesCount = 0;
  let skippedCategoriesCount = 0;
  let createdSubcategoriesCount = 0;
  let skippedSubcategoriesCount = 0;

  for (const cat of categoriesData) {
    const targetId = cat.id || crypto.randomUUID();

    let existingCategory = await prisma.productCategory.findFirst({
      where: {
        OR: [{ id: targetId }, { slug: cat.slug }],
      },
    });

    let categoryId = existingCategory?.id;

    if (!existingCategory) {
      const newCat = await prisma.productCategory.create({
        data: {
          id: targetId,
          name: cat.name,
          slug: cat.slug,
          description: cat.description || null,
          image: cat.image || null,
          status: cat.status || 'ACTIVE',
        },
      });
      categoryId = newCat.id;
      createdCategoriesCount++;
      console.log(`  ➕ Created Category: "${cat.name}" [UUID: ${categoryId}]`);
    } else {
      skippedCategoriesCount++;
      console.log(`  ⏭️  Skipped Existing Category: "${cat.name}" [UUID: ${categoryId}]`);
    }

    if (cat.subcategories && cat.subcategories.length > 0 && categoryId) {
      for (const sub of cat.subcategories) {
        const subTargetId = sub.id || crypto.randomUUID();

        const existingSub = await prisma.productSubcategory.findFirst({
          where: {
            OR: [{ id: subTargetId }, { slug: sub.slug }],
          },
        });

        if (!existingSub) {
          const newSub = await prisma.productSubcategory.create({
            data: {
              id: subTargetId,
              name: sub.name,
              slug: sub.slug,
              description: sub.description || null,
              image: sub.image || null,
              status: sub.status || 'ACTIVE',
              categoryId: categoryId,
            },
          });
          createdSubcategoriesCount++;
          console.log(`      └─ ➕ Created Subcategory: "${sub.name}" [UUID: ${newSub.id}]`);
        } else {
          skippedSubcategoriesCount++;
          console.log(`      └─ ⏭️  Skipped Existing Subcategory: "${sub.name}" [UUID: ${existingSub.id}]`);
        }
      }
    }
  }

  console.log(`\n🎉 Categories Seeding Completed:`);
  console.log(`   Categories: ${createdCategoriesCount} Created, ${skippedCategoriesCount} Skipped`);
  console.log(`   Subcategories: ${createdSubcategoriesCount} Created, ${skippedSubcategoriesCount} Skipped`);
}

async function seedBrands() {
  const jsonPath = path.join(__dirname, 'brands-data.json');
  if (!fs.existsSync(jsonPath)) {
    console.warn(`⚠️ Warning: Brands seed file not found at ${jsonPath}`);
    return;
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const brandsData: Array<{
    id?: string;
    name: string;
    slug: string;
    logo?: string;
    description?: string;
    website?: string;
    status?: 'ACTIVE' | 'INACTIVE';
  }> = JSON.parse(rawData);

  console.log(`\n🏷️  Seeding ${brandsData.length} Product Brands...`);

  let createdBrandsCount = 0;
  let skippedBrandsCount = 0;

  for (const b of brandsData) {
    const targetId = b.id || crypto.randomUUID();

    const existingBrand = await prisma.productBrand.findFirst({
      where: {
        OR: [{ id: targetId }, { name: b.name }, { slug: b.slug }],
      },
    });

    if (!existingBrand) {
      const newBrand = await prisma.productBrand.create({
        data: {
          id: targetId,
          name: b.name,
          slug: b.slug,
          logo: b.logo || null,
          description: b.description || null,
          website: b.website || null,
          status: b.status || 'ACTIVE',
        },
      });
      createdBrandsCount++;
      console.log(`  ➕ Created Brand: "${newBrand.name}" [UUID: ${newBrand.id}]`);
    } else {
      skippedBrandsCount++;
      console.log(`  ⏭️  Skipped Existing Brand: "${b.name}" [UUID: ${existingBrand.id}]`);
    }
  }

  console.log(`\n🎉 Brands Seeding Completed: ${createdBrandsCount} Created, ${skippedBrandsCount} Skipped`);
}

async function seedProducts() {
  const jsonPath = path.join(__dirname, 'products-data.json');

  if (!fs.existsSync(jsonPath)) {
    console.log(`\n⚙️  Generating 200 Products Seed Data (${jsonPath})...`);
    
    const categoriesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'categories-data.json'), 'utf-8'));
    const brandsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'brands-data.json'), 'utf-8'));

    const brandMap: Record<string, string> = {};
    brandsData.forEach((b: any) => { brandMap[b.slug] = b.id; });

    const categoryMap: Record<string, { id: string; subcategories: Record<string, string> }> = {};
    categoriesData.forEach((c: any) => {
      const subMap: Record<string, string> = {};
      c.subcategories.forEach((s: any) => { subMap[s.slug] = s.id; });
      categoryMap[c.slug] = { id: c.id, subcategories: subMap };
    });

    const proteinImages = [
      "https://images.unsplash.com/photo-1593095940071-007d80173876?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"
    ];

    const skincareImages = [
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=800&q=80"
    ];

    const haircareImages = [
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1608248597261-e4d044696386?auto=format&fit=crop&w=800&q=80"
    ];

    const cosmeticsImages = [
      "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80"
    ];

    const wellnessImages = [
      "https://images.unsplash.com/photo-1550572017-edd951aa8f72?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=800&q=80"
    ];

    const templates = [
      {
        cat: 'proteins-fitness-supplements', sub: 'whey-isolate-concentrates',
        brands: ['optimum-nutrition', 'muscleblaze', 'dymatize'],
        names: ['Gold Standard 100% Whey Isolate', 'Biozyme Performance Whey', 'ISO100 Hydrolyzed Protein', 'Raw Whey Protein Concentrate', 'Ultra Pure Whey Isolate', 'Whey Gold Fast Absorbing', 'Nitro Muscle Builder Whey', 'Clean Whey Isolate Unflavored', 'Triple Chocolate Whey Isolate', 'Double Rich Chocolate Protein'],
        prefs: ['VEGETARIAN', 'VEGAN', 'EGGITARIAN'], images: proteinImages, basePrice: 4500, hasVariants: true,
        flavors: ['Double Rich Chocolate', 'Vanilla Ice Cream', 'Extreme Milk Chocolate', 'Strawberries & Cream'], weights: ['1 kg', '2 kg', '5 lbs']
      },
      {
        cat: 'proteins-fitness-supplements', sub: 'plant-organic-protein',
        brands: ['wellbeing-nutrition', 'muscleblaze'],
        names: ['Superfood Plant Protein Pea & Rice', 'Organic Vegan Pea Protein Blend', 'Plant Protein Isolate Vanilla', 'Raw Organic Plant Protein', 'Complete Vegan Protein Powder', 'Clean Green Plant Protein Shake', 'Pea & Pumpkin Seed Protein', 'Dairy-Free Fitness Protein', 'Digestive Enzyme Plant Protein', 'Keto Vegan Plant Protein'],
        prefs: ['VEGAN'], images: proteinImages, basePrice: 2800, hasVariants: true,
        flavors: ['Rich Dark Chocolate', 'French Vanilla', 'Berry Blast'], weights: ['500g', '1 kg']
      },
      {
        cat: 'proteins-fitness-supplements', sub: 'bcaa-pre-workouts',
        brands: ['optimum-nutrition', 'muscleblaze', 'dymatize'],
        names: ['Essential Amino Energy Pre-Workout', 'WrathX Explosive Pre-Workout', 'BCAA 6000 Amino Ratio 2:1:1', 'Gold Standard Pre-Workout Nitric', 'Intra-Workout Hydration BCAA', 'Clean Energy Pre-Workout', 'Super Pump Pre-Workout Matrix', 'Amino Endurance BCAA Powder', 'Recovery BCAA Glutamine Mix', 'Extreme Nitric Oxide Pump'],
        prefs: ['VEGETARIAN', 'VEGAN'], images: proteinImages, basePrice: 1999, hasVariants: true,
        flavors: ['Green Apple', 'Blue Raspberry', 'Watermelon'], weights: ['300g', '600g']
      },
      {
        cat: 'proteins-fitness-supplements', sub: 'creatine-mass-gainers',
        brands: ['optimum-nutrition', 'muscleblaze'],
        names: ['Micronized Creatine Monohydrate 200 Mesh', 'Super Mass Gainer High Calorie', 'Creatine HCL Ultra Pure Powder', 'High Protein Lean Mass Gainer', 'Creatine Monohydrate Creapure Quality', 'Extreme Bulk Mass Gainer XXL', 'Mass Gainer Complex 1000 Calories', 'Creapure Micronized Muscle Powder', 'Carbo Fuel Instant Energy Matrix', 'Hardgainer Weight Gainer Formula'],
        prefs: ['VEGETARIAN'], images: proteinImages, basePrice: 1299, hasVariants: false
      },
      {
        cat: 'skincare-facial-care', sub: 'face-serums-glow-elixirs',
        brands: ['the-ordinary', 'cerave', 'la-roche-posay'],
        names: ['Niacinamide 10% + Zinc 1% Blemish Serum', 'Hyaluronic Acid 2% + B5 Hydration Serum', 'Vitamin C 15% Brightening Glow Serum', 'AHA 30% + BHA 2% Peeling Solution', 'Retinol 0.5% in Squalane Anti-Aging Elixir', 'Salicylic Acid 2% Exfoliating Serum', 'Alpha Arbutin 2% Dark Spot Corrector', 'Skin Renewing Vitamin C Serum', 'Effaclar Serum Salicylic & Glycolic Acid', 'Pure Niacinamide 10 Anti-Dark Spot Serum'],
        prefs: ['VEGAN', 'NOT_APPLICABLE'], images: skincareImages, basePrice: 850, hasVariants: true,
        flavors: [], weights: ['30 ml', '60 ml']
      },
      {
        cat: 'skincare-facial-care', sub: 'moisturizers-night-creams',
        brands: ['cerave', 'the-ordinary', 'la-roche-posay'],
        names: ['Moisturizing Cream with 3 Essential Ceramides', 'Daily Moisturizing Lotion Oil-Free', 'Natural Moisturizing Factors + HA Hydrator', 'Toleriane Double Repair Face Moisturizer', 'PM Facial Moisturizing Lotion Ultra Lightweight', 'Skin Renewing Night Cream Peptides', 'Hydro Boost Water Gel Hyaluronic Cream', 'Barrier Repair Barrier Cream Centella', 'Cicaplast Baume B5 Soothing Cream', 'Gentle Skin Hydrating Face Cream'],
        prefs: ['VEGAN', 'NOT_APPLICABLE'], images: skincareImages, basePrice: 1250, hasVariants: false
      },
      {
        cat: 'skincare-facial-care', sub: 'sunscreen-uv-protection',
        brands: ['la-roche-posay', 'cerave', 'the-ordinary'],
        names: ['Anthelios Melt-In Milk Sunscreen SPF 60', 'Mineral Sunscreen Broad Spectrum SPF 50', 'Oil-Free Gel Sunscreen SPF 50 PA++++', 'Hydrating Mineral Sunscreen Sheer Tint SPF 30', 'Anthelios Ultra Light Fluid SPF 50+', 'Water Resistant Sports Sunscreen SPF 50', 'Invisible Shield Gel Sunscreen SPF 50', 'Matte Finish Sunscreen Fluid SPF 50', 'Daily Facial Defence Sunscreen SPF 50', 'UV Defend Light Lotion SPF 50'],
        prefs: ['VEGAN', 'NOT_APPLICABLE'], images: skincareImages, basePrice: 1499, hasVariants: false
      },
      {
        cat: 'salon-haircare-excellence', sub: 'keratin-anti-frizz-shampoos',
        brands: ['loreal-professionnel', 'olaplex'],
        names: ['Absolut Repair Molecular Repair Shampoo', 'No. 4 Bond Maintenance Smoothing Shampoo', 'Professional Serie Expert Liss Unlimited Shampoo', 'Keratin Smooth Anti-Frizz Hair Cleanser', 'Pro Longer Lengths Renewing Shampoo', 'Sulfate Free Keratin Moisture Shampoo', 'No. 4C Bond Maintenance Clarifying Shampoo', 'Mythic Oil Nourishing Argan Shampoo', 'Scalp Advanced Anti-Dandruff Shampoo', 'Inforcer Strengthening Biotin Shampoo'],
        prefs: ['VEGAN', 'NOT_APPLICABLE'], images: haircareImages, basePrice: 1650, hasVariants: true,
        flavors: [], weights: ['250 ml', '500 ml', '1500 ml']
      },
      {
        cat: 'salon-haircare-excellence', sub: 'nourishing-scalp-oils-serums',
        brands: ['loreal-professionnel', 'olaplex'],
        names: ['No. 7 Bonding Hair Oil Thermal Heat Protectant', 'Mythic Oil Rich Nourishing Serum', 'Serie Expert Absolut Repair Oil 10-in-1', 'No. 9 Bond Protector Hair Serum', 'Rosemary Hair Growth Scalp Elixir', 'Pure Argan Hair Repair Treatment Oil', 'Scalp Density Serum Anti-Hairloss', 'Anti-Frizz Smoothing Hair Serum', 'Strengthening Keratin Leave-In Serum', 'Shine Enhancing Hair Polish Serum'],
        prefs: ['VEGAN', 'NOT_APPLICABLE'], images: haircareImages, basePrice: 1950, hasVariants: false
      },
      {
        cat: 'beauty-luxury-cosmetics', sub: 'matte-lipsticks-gloss',
        brands: ['mac-cosmetics', 'maybelline-new-york'],
        names: ['Retro Matte Lipstick Ruby Woo Classic Red', 'SuperStay Matte Ink Liquid Lipstick Longwear', 'Matte Velvet Powder Kiss Lipstick', 'Lifter Lip Gloss Hyaluronic Acid Plumping', 'Sensational Liquid Matte Lip Color', 'Powder Kiss Liquid Lipcolor Soft Matte', 'SuperStay Vinyl Ink Longwear Liquid Lipcolor', 'Lustreglass Sheer Shine Lipstick', 'Ultimate Matte Crayon Lip Color', 'Hyper Gloss Plumping Lip Oil'],
        prefs: ['VEGAN', 'NOT_APPLICABLE'], images: cosmeticsImages, basePrice: 1100, hasVariants: true,
        flavors: [], weights: ['Ruby Red', 'Nude Pink', 'Warm Mocha', 'Berry Wine']
      },
      {
        cat: 'beauty-luxury-cosmetics', sub: 'foundations-concealers',
        brands: ['mac-cosmetics', 'maybelline-new-york'],
        names: ['Studio Fix Fluid SPF 15 24HR Foundation', 'Fit Me Matte + Poreless Liquid Foundation', 'Instant Age Rewind Eraser Multi-Use Concealer', 'Studio Fix Every-Wear All-Over Face Pen', 'SuperStay 30H Full Coverage Foundation', 'Fit Me Concealer High Coverage Oil-Free', 'Pro Longwear Concealer Water Resistant', 'Luminous Glow Liquid Foundation SPF 20', 'Skin Tint Light Coverage Serum Foundation', 'Velvet Full Coverage Matte Concealer'],
        prefs: ['VEGAN', 'NOT_APPLICABLE'], images: cosmeticsImages, basePrice: 1350, hasVariants: true,
        flavors: [], weights: ['NC15', 'NC20', 'NC25', 'NC30', 'NC35']
      },
      {
        cat: 'wellness-daily-health', sub: 'multivitamins-minerals',
        brands: ['wellbeing-nutrition'],
        names: ['Daily Multivitamin Melts Organic Plant Extracts', 'Slow Multivitamin for Men 2-in-1 Tech', 'Slow Multivitamin for Women 2-in-1 Tech', 'Whole Food Multivitamin Gummy Berry Flavor', 'Organic Vitamin C 1000mg Zinc Effervescent', 'Vitamin D3 + K2 Bone Strength Capsules', 'Active Hair Multivitamin Biotin & Keratin', 'Stress Relief Ashwagandha Magnesium Tablet', 'Gut Health Probiotics 50 Billion CFU', 'Immunity Booster Zinc & Elderberry Melts'],
        prefs: ['VEGETARIAN', 'VEGAN'], images: wellnessImages, basePrice: 890, hasVariants: false
      },
      {
        cat: 'wellness-daily-health', sub: 'omega-3-joint-support',
        brands: ['wellbeing-nutrition'],
        names: ['Triple Strength Omega-3 Fish Oil 1000mg EPA/DHA', 'Vegan Omega 3 6 9 Algal Oil Capsules', 'Wild Caught Deep Sea Fish Oil Softgels', 'Joint Support Glucosamine Chondroitin Collagen', 'Pure Hawaiian Astaxanthin Antioxidant', 'Curcumin Collagen Joint Ease Capsules', 'Krill Oil Phospholipid Omega-3 Matrix', 'Zero Fishy Burp Omega-3 Lemon Softgel', 'Heart Health Omega-3 CoQ10 Complex', 'Advanced Joint Flexibility Repair Formula'],
        prefs: ['NON_VEGETARIAN', 'VEGAN', 'VEGETARIAN'], images: wellnessImages, basePrice: 1190, hasVariants: false
      }
    ];

    const generatedProducts: any[] = [];
    let globalIndex = 1;
    let loopCounter = 0;

    while (generatedProducts.length < 200) {
      loopCounter++;
      for (const t of templates) {
        if (generatedProducts.length >= 200) break;

        const catObj = categoryMap[t.cat];
        if (!catObj) continue;
        const subId = catObj.subcategories[t.sub];
        if (!subId) continue;

        const brandSlug = t.brands[(globalIndex + loopCounter) % t.brands.length];
        const brandId = brandMap[brandSlug];

        const baseName = t.names[globalIndex % t.names.length];
        const itemTitle = loopCounter === 1 ? baseName : `${baseName} Vol. ${loopCounter}`;
        const slug = itemTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + `-${globalIndex}`;
        const sku = `SKU-${t.cat.substring(0, 3).toUpperCase()}-${globalIndex.toString().padStart(4, '0')}`;
        const image = t.images[globalIndex % t.images.length];

        const price = t.basePrice + (globalIndex % 5) * 150;
        const discountPrice = Math.round(price * 0.85);
        const stock = (globalIndex % 7 === 0) ? 0 : 10 + (globalIndex * 7) % 90;
        const pref = t.prefs[globalIndex % t.prefs.length];

        const productObj: any = {
          id: crypto.randomUUID(),
          title: itemTitle,
          slug: slug,
          description: `Premium quality ${itemTitle} manufactured by ${brandSlug}. Formulated for maximum effectiveness and superior results.`,
          unitPrice: price,
          discountPercentage: discountPrice ? Math.round((1 - (discountPrice / price)) * 100) : 0,
          gst: 18,
          expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
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

        if (t.hasVariants && globalIndex % 2 === 0) {
          productObj.variants = [];
          const flavorList = t.flavors || [];
          const weightList = t.weights || [];

          if (flavorList.length > 0) {
            flavorList.slice(0, 3).forEach((flv, vIdx) => {
              const varPrice = price + vIdx * 200;
              const varDiscountPrice = Math.round(varPrice * 0.85);
              productObj.variants.push({
                id: crypto.randomUUID(),
                title: `${itemTitle} - ${flv}`,
                sku: `${sku}-V${vIdx + 1}`,
                flavor: flv,
                weight: weightList[vIdx % weightList.length] || null,
                unitPrice: varPrice,
                discountPercentage: varDiscountPrice ? Math.round((1 - (varDiscountPrice / varPrice)) * 100) : 0,
                gst: 18,
                stock: stock + vIdx * 5,
                images: [image],
              });
            });
          } else if (weightList.length > 0) {
            weightList.slice(0, 3).forEach((wgt, vIdx) => {
              const varPrice = price + vIdx * 250;
              const varDiscountPrice = Math.round(varPrice * 0.85);
              productObj.variants.push({
                id: crypto.randomUUID(),
                title: `${itemTitle} - ${wgt}`,
                sku: `${sku}-W${vIdx + 1}`,
                flavor: null,
                weight: wgt,
                unitPrice: varPrice,
                discountPercentage: varDiscountPrice ? Math.round((1 - (varDiscountPrice / varPrice)) * 100) : 0,
                gst: 18,
                stock: stock + vIdx * 5,
                images: [image],
              });
            });
          }
        }

        generatedProducts.push(productObj);
        globalIndex++;
      }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(generatedProducts, null, 2), 'utf-8');
    console.log(`  ✅ Generated ${generatedProducts.length} Products JSON at ${jsonPath}`);
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const productsData: any[] = JSON.parse(rawData);

  console.log(`\n🛍️  Seeding ${productsData.length} Products & Variants...`);

  let createdProductsCount = 0;
  let skippedProductsCount = 0;
  let createdVariantsCount = 0;

  for (const p of productsData) {
    const targetId = p.id || crypto.randomUUID();

    const existingProduct = await prisma.product.findFirst({
      where: {
        OR: [{ id: targetId }, { slug: p.slug }, { sku: p.sku }],
      },
    });

    if (!existingProduct) {
      const productData: any = {
        id: targetId,
        title: p.title,
        slug: p.slug,
        description: p.description || null,
        unitPrice: Number(p.price),
        discountPercentage: p.discountPrice ? Math.round((1 - (Number(p.discountPrice) / Number(p.price))) * 100) : 0,
        gst: 18,
        expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 year from now
        sku: p.sku,
        stock: Number(p.stock || 0),
        lowStockAlert: Number(p.lowStockAlert || 5),
        images: p.images || [],
        status: p.status || 'ACTIVE',
        categoryId: p.categoryId || null,
        subcategoryId: p.subcategoryId || null,
        brandId: p.brandId || null,
        preference: p.preference || 'NOT_APPLICABLE',
        variants: p.variants && p.variants.length > 0 ? {
          create: p.variants.map((v: any) => ({
            id: v.id || crypto.randomUUID(),
            title: v.title,
            sku: v.sku,
            flavor: v.flavor || null,
            weight: v.weight || null,
            unitPrice: Number(v.price),
            discountPercentage: v.discountPrice ? Math.round((1 - (Number(v.discountPrice) / Number(v.price))) * 100) : 0,
            gst: 18,
            stock: Number(v.stock || 0),
            images: v.images || [],
          }))
        } : undefined
      };

      const created: any = await prisma.product.create({
        data: productData,
        include: { variants: true }
      });

      createdProductsCount++;
      const variantCount = created.variants ? created.variants.length : 0;
      createdVariantsCount += variantCount;
      console.log(`  ➕ Created Product: "${created.title}" [SKU: ${created.sku}] with ${variantCount} variants`);
    } else {
      skippedProductsCount++;
    }
  }

  console.log(`\n🎉 Products Seeding Completed:`);
  console.log(`   Products: ${createdProductsCount} Created, ${skippedProductsCount} Skipped`);
  console.log(`   Variants: ${createdVariantsCount} Created`);
}

async function seedShipping() {
  const jsonPath = path.join(__dirname, 'shipping-data.json');
  let threshold = 2000;
  let rules: any[] = [];

  if (fs.existsSync(jsonPath)) {
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const shippingData = JSON.parse(rawData);
    threshold = shippingData.threshold ?? 2000;
    rules = shippingData.rules || [];
  } else {
    rules = [
      {
        name: 'Delhi/HR/PB/HP',
        states: ['Delhi', 'Haryana', 'Punjab', 'Himachal Pradesh'],
        charge: 75,
        isDefault: false,
      },
      {
        name: 'UP/UK/RJ',
        states: ['Uttar Pradesh', 'Uttarakhand', 'Rajasthan'],
        charge: 85,
        isDefault: false,
      },
      {
        name: 'Metro Cities',
        states: ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'West Bengal', 'Telangana', 'Gujarat'],
        charge: 115,
        isDefault: false,
      },
      {
        name: 'North East',
        states: ['Arunachal Pradesh', 'Assam', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura'],
        charge: 150,
        isDefault: false,
      },
      {
        name: 'Rest of India',
        states: [],
        charge: 130,
        isDefault: true,
      }
    ];
  }

  console.log(`\n🚚 Seeding Shipping Rules & Settings...`);
  
  await prisma.storeSetting.upsert({
    where: { key: 'FREE_SHIPPING_THRESHOLD' },
    update: { value: threshold.toString() },
    create: {
      key: 'FREE_SHIPPING_THRESHOLD',
      value: threshold.toString(),
      description: 'Minimum cart subtotal to qualify for free shipping',
    },
  });

  for (const rule of rules) {
    await prisma.shippingRule.upsert({
      where: { name: rule.name },
      update: { states: rule.states, charge: rule.charge, isDefault: rule.isDefault },
      create: { name: rule.name, states: rule.states, charge: rule.charge, isDefault: rule.isDefault },
    });
  }

  console.log(`✅ Shipping Rules (${rules.length}) & Free Threshold (₹${threshold}) seeded successfully.`);
}

async function seedSupportInfo() {
  const jsonPath = path.join(__dirname, 'support-data.json');
  if (!fs.existsSync(jsonPath)) {
    console.log(`\n⏭️  Skipping Support Info: support-data.json not found.`);
    return;
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const supportData: any[] = JSON.parse(rawData);

  console.log(`\n📞 Seeding ${supportData.length} Support Contacts...`);

  for (const info of supportData) {
    const existing = await prisma.supportInfo.findFirst({
      where: { type: info.type }
    });

    if (!existing) {
      await prisma.supportInfo.create({
        data: {
          type: info.type,
          email: info.email,
          mobileNumber: info.mobileNumber,
          whatsappNumber: info.whatsappNumber,
          address: info.address,
          operatingHours: info.operatingHours,
        }
      });
      console.log(`  ➕ Created Support Contact: "${info.type}"`);
    } else {
      console.log(`  ⏭️  Skipped Existing Support Contact: "${info.type}"`);
    }
  }
}

async function seedReviewsAndGuides() {
  console.log(`\n📝 Seeding Dummy Guides and Reviews...`);

  // Guides
  await prisma.guide.deleteMany({});
  
  const guidesPath = path.join(__dirname, 'guides-data.json');
    let guides: any[] = [];
    if (fs.existsSync(guidesPath)) {
      guides = JSON.parse(fs.readFileSync(guidesPath, 'utf-8'));
    } else {
      console.warn(`⚠️ Warning: Seed file not found at ${guidesPath}`);
    }

    for (const g of guides) {
      await prisma.guide.create({ data: g });
    }
    console.log(`  ✅ Seeded ${guides.length} Guides`);

  // Reviews
  const reviewsCount = await prisma.productReview.count();
  if (reviewsCount === 0) {
    const products = await prisma.product.findMany({ take: 5 });
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, include: { profile: true } });
    
    if (products.length > 0 && adminUser?.profile) {
      const reviewsPath = path.join(__dirname, 'review-rating.json');
      let reviewers: any[] = [];
      if (fs.existsSync(reviewsPath)) {
        reviewers = JSON.parse(fs.readFileSync(reviewsPath, 'utf-8'));
      } else {
        console.warn(`⚠️ Warning: Seed file not found at ${reviewsPath}`);
        return;
      }

      for (let i = 0; i < reviewers.length; i++) {
        await prisma.productReview.create({
          data: {
            productId: products[i % products.length].id,
            userProfileId: adminUser.profile.id,
            rating: 5,
            title: "Great Product",
            comment: reviewers[i].review,
            isVerifiedPurchase: true,
            status: 'APPROVED'
          }
        });
      }
      console.log(`  ✅ Seeded 10 Dummy Reviews`);
    }
  }
}

async function main() {
  const isSeedEnabled = process.env.ENABLE_SEED === 'true' || process.env.RUN_SEED === 'true';

  if (!isSeedEnabled) {
    console.log(`\n⏭️  Seeding Skipped: ENABLE_SEED environment variable is false or unset in .env.`);
    console.log(`   Set ENABLE_SEED="true" in .env to enable database seeding.`);
    return;
  }

  await seedAdminUser();
  await seedCategoriesAndSubcategories();
  await seedBrands();
  await seedProducts();
  await seedShipping();
  await seedSupportInfo();
  await seedReviewsAndGuides();
}

main()
  .catch((e) => {
    console.error('❌ Seed script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
