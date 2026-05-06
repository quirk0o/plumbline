import {
  PrismaClient,
  PackType,
  TraitType,
  TraitCategory,
  AspirationCategory,
  CareerType,
  LifeStage,
} from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL environment variable is not set')
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding reference data...')

  // ── Packs ─────────────────────────────────────────────────────────────────
  const SPRITE = (fragment: string) => `/images/packs/sims_icons.svg#${fragment}`
  const packSeed = [
    { name: 'Base Game',            type: PackType.BASE_GAME,  icon: '🏠', code: 'SIMS4', imageUrl: SPRITE('SIMS4') },
    { name: 'Get to Work',          type: PackType.EXPANSION,  icon: '💼', code: 'EP01',  imageUrl: SPRITE('EP01') },
    { name: 'Get Together',         type: PackType.EXPANSION,  icon: '🎉', code: 'EP02',  imageUrl: SPRITE('EP02') },
    { name: 'City Living',          type: PackType.EXPANSION,  icon: '🏙️', code: 'EP03',  imageUrl: SPRITE('EP03') },
    { name: 'Cats & Dogs',          type: PackType.EXPANSION,  icon: '🐾', code: 'EP04',  imageUrl: SPRITE('EP04') },
    { name: 'Seasons',              type: PackType.EXPANSION,  icon: '🍂', code: 'EP05',  imageUrl: SPRITE('EP05') },
    { name: 'Discover University',  type: PackType.EXPANSION,  icon: '🎓', code: 'EP08',  imageUrl: SPRITE('EP08') },
    { name: 'Eco Lifestyle',        type: PackType.EXPANSION,  icon: '♻️', code: 'EP09',  imageUrl: SPRITE('EP09') },
    { name: 'Snowy Escape',         type: PackType.EXPANSION,  icon: '⛷️', code: 'EP10',  imageUrl: SPRITE('EP10-solid') },
    { name: 'Cottage Living',       type: PackType.EXPANSION,  icon: '🌿', code: 'EP11',  imageUrl: SPRITE('EP11') },
    { name: 'High School Years',    type: PackType.EXPANSION,  icon: '📚', code: 'EP12',  imageUrl: SPRITE('EP12') },
    { name: 'Growing Together',     type: PackType.EXPANSION,  icon: '👶', code: 'EP13',  imageUrl: SPRITE('EP13') },
    { name: 'Horse Ranch',          type: PackType.EXPANSION,  icon: '🐴', code: 'EP14',  imageUrl: SPRITE('EP14') },
    { name: 'For Rent',             type: PackType.EXPANSION,  icon: '🏘️', code: 'EP15',  imageUrl: SPRITE('EP15') },
    { name: 'Lovestruck',           type: PackType.EXPANSION,  icon: '💕', code: 'EP16',  imageUrl: SPRITE('EP16') },
    { name: 'Life & Death',         type: PackType.EXPANSION,  icon: '💀', code: 'EP17',  imageUrl: SPRITE('EP17-solid') },
    { name: 'Businesses & Hobbies', type: PackType.EXPANSION,  icon: '🏪', code: 'EP18',  imageUrl: SPRITE('EP18') },
    { name: 'Outdoor Retreat',      type: PackType.GAME_PACK,  icon: '🏕️', code: 'GP01',  imageUrl: SPRITE('GP01') },
    { name: 'Spa Day',              type: PackType.GAME_PACK,  icon: '🧖', code: 'GP02',  imageUrl: SPRITE('GP02') },
    { name: 'Dine Out',             type: PackType.GAME_PACK,  icon: '🍽️', code: 'GP03',  imageUrl: SPRITE('GP03') },
    { name: 'Vampires',             type: PackType.GAME_PACK,  icon: '🧛', code: 'GP04',  imageUrl: SPRITE('GP04') },
    { name: 'Parenthood',           type: PackType.GAME_PACK,  icon: '👨‍👩‍👧', code: 'GP05',  imageUrl: SPRITE('GP05') },
    { name: 'Jungle Adventure',     type: PackType.GAME_PACK,  icon: '🌴', code: 'GP06',  imageUrl: SPRITE('GP06') },
    { name: 'StrangerVille',        type: PackType.GAME_PACK,  icon: '👽', code: 'GP07',  imageUrl: SPRITE('GP07') },
    { name: 'Realm of Magic',       type: PackType.GAME_PACK,  icon: '🔮', code: 'GP08',  imageUrl: SPRITE('GP08') },
    { name: 'Dream Home Decorator', type: PackType.GAME_PACK,  icon: '🛋️', code: 'GP10',  imageUrl: SPRITE('GP10') },
    { name: 'My Wedding Stories',   type: PackType.GAME_PACK,  icon: '💍', code: 'GP11',  imageUrl: SPRITE('GP11') },
    { name: 'Werewolves',           type: PackType.GAME_PACK,  icon: '🐺', code: 'GP12',  imageUrl: SPRITE('GP12-solid') },
    // Stuff Packs
    { name: 'Luxury Party Stuff',   type: PackType.STUFF_PACK, icon: '🥂', code: 'SP01',  imageUrl: SPRITE('SP01') },
    { name: 'Perfect Patio Stuff',  type: PackType.STUFF_PACK, icon: '🌞', code: 'SP02',  imageUrl: SPRITE('SP02') },
    { name: 'Cool Kitchen Stuff',   type: PackType.STUFF_PACK, icon: '🧁', code: 'SP03',  imageUrl: SPRITE('SP03') },
    { name: 'Spooky Stuff',         type: PackType.STUFF_PACK, icon: '🎃', code: 'SP04',  imageUrl: SPRITE('SP04') },
    { name: 'Movie Hangout Stuff',  type: PackType.STUFF_PACK, icon: '🍿', code: 'SP05',  imageUrl: SPRITE('SP05') },
    { name: 'Romantic Garden Stuff',type: PackType.STUFF_PACK, icon: '🌹', code: 'SP06',  imageUrl: SPRITE('SP06') },
    { name: 'Kids Room Stuff',      type: PackType.STUFF_PACK, icon: '🧸', code: 'SP07',  imageUrl: SPRITE('SP07') },
    { name: 'Fitness Stuff',        type: PackType.STUFF_PACK, icon: '🏋️', code: 'SP11',  imageUrl: SPRITE('SP11') },
    { name: 'Toddler Stuff',        type: PackType.STUFF_PACK, icon: '🎠', code: 'SP12',  imageUrl: SPRITE('SP12') },
    { name: 'Laundry Day Stuff',    type: PackType.STUFF_PACK, icon: '🧺', code: 'SP13',  imageUrl: SPRITE('SP13') },
    { name: 'My First Pet Stuff',   type: PackType.STUFF_PACK, icon: '🐹', code: 'SP14',  imageUrl: SPRITE('SP14') },
    { name: 'Tiny Living Stuff',    type: PackType.STUFF_PACK, icon: '🏠', code: 'SP16',  imageUrl: SPRITE('SP16') },
    { name: 'Nifty Knitting Stuff', type: PackType.STUFF_PACK, icon: '🧶', code: 'SP17',  imageUrl: SPRITE('SP17') },
    { name: 'Paranormal Stuff',     type: PackType.STUFF_PACK, icon: '👻', code: 'SP18',  imageUrl: SPRITE('SP18') },
    { name: 'Crystal Creations',    type: PackType.STUFF_PACK, icon: '💎', code: 'SP49',  imageUrl: SPRITE('SP49') },
    // Kits
    { name: 'Blooming Rooms Kit',   type: PackType.KIT,        icon: '🌸', code: 'SP29',  imageUrl: SPRITE('SP29') },
    { name: 'Bust the Dust Kit',    type: PackType.KIT,        icon: '🧹', code: 'SP22',  imageUrl: SPRITE('SP22') },
    { name: 'Country Kitchen Kit',  type: PackType.KIT,        icon: '🫙', code: 'SP21',  imageUrl: SPRITE('SP21') },
    { name: 'Courtyard Oasis Kit',  type: PackType.KIT,        icon: '🏺', code: 'SP23',  imageUrl: SPRITE('SP23') },
    { name: 'Desert Luxe Kit',      type: PackType.KIT,        icon: '🏜️', code: 'SP35',  imageUrl: SPRITE('SP35') },
    { name: 'Everyday Clutter Kit', type: PackType.KIT,        icon: '📦', code: 'SP37',  imageUrl: SPRITE('SP37') },
    { name: 'Fashion Street Kit',   type: PackType.KIT,        icon: '👟', code: 'SP24',  imageUrl: SPRITE('SP24') },
    { name: 'Incheon Arrivals',     type: PackType.KIT,        icon: '✈️', code: 'SP26',  imageUrl: SPRITE('SP26') },
    { name: 'Industrial Loft Kit',  type: PackType.KIT,        icon: '🏗️', code: 'SP25',  imageUrl: SPRITE('SP25') },
    { name: 'Moonlight Chic Kit',   type: PackType.KIT,        icon: '🌙', code: 'SP32',  imageUrl: SPRITE('SP32') },
    { name: 'Modern Menswear Kit',  type: PackType.KIT,        icon: '🕶️', code: 'SP28',  imageUrl: SPRITE('SP28') },
    { name: 'Pastel Pop Kit',       type: PackType.KIT,        icon: '🎨', code: 'SP36',  imageUrl: SPRITE('SP36') },
    { name: 'Simtimates Kit',       type: PackType.KIT,        icon: '🛁', code: 'SP38',  imageUrl: SPRITE('SP38') },
    { name: 'Throwback Fit Kit',    type: PackType.KIT,        icon: '📼', code: 'SP20',  imageUrl: SPRITE('SP20') },
  ]

  for (const p of packSeed) {
    await prisma.pack.upsert({
      where: { name: p.name },
      update: { icon: p.icon, code: p.code ?? null, imageUrl: p.imageUrl ?? null },
      create: p,
    })
  }

  const pack = async (name: string) => {
    const p = await prisma.pack.findUniqueOrThrow({ where: { name } })
    return p.id
  }

  // ── Personality Traits ────────────────────────────────────────────────────
  const personalityTraitSeed: Array<{
    name: string
    category: TraitCategory
    minLifeStage?: LifeStage
    maxLifeStage?: LifeStage
    packId?: string
  }> = [
    // Emotional
    { name: 'Cheerful',      category: TraitCategory.EMOTIONAL },
    { name: 'Gloomy',        category: TraitCategory.EMOTIONAL },
    { name: 'Hot-Headed',    category: TraitCategory.EMOTIONAL },
    { name: 'Good',          category: TraitCategory.EMOTIONAL },
    { name: 'Evil',          category: TraitCategory.EMOTIONAL },
    { name: 'Erratic',       category: TraitCategory.EMOTIONAL },
    { name: 'Self-Assured',  category: TraitCategory.EMOTIONAL },
    // Hobby
    { name: 'Art Lover',     category: TraitCategory.HOBBY },
    { name: 'Bookworm',      category: TraitCategory.HOBBY },
    { name: 'Creative',      category: TraitCategory.HOBBY },
    { name: 'Foodie',        category: TraitCategory.HOBBY },
    { name: 'Geek',          category: TraitCategory.HOBBY },
    { name: 'Loves Outdoors',category: TraitCategory.HOBBY },
    { name: 'Music Lover',   category: TraitCategory.HOBBY },
    // Lifestyle
    { name: 'Active',        category: TraitCategory.LIFESTYLE },
    { name: 'Ambitious',     category: TraitCategory.LIFESTYLE },
    { name: 'Clumsy',        category: TraitCategory.LIFESTYLE },
    { name: 'Genius',        category: TraitCategory.LIFESTYLE },
    { name: 'Glutton',       category: TraitCategory.LIFESTYLE },
    { name: 'Kleptomaniac',  category: TraitCategory.LIFESTYLE },
    { name: 'Lazy',          category: TraitCategory.LIFESTYLE },
    { name: 'Neat',          category: TraitCategory.LIFESTYLE },
    { name: 'Slob',          category: TraitCategory.LIFESTYLE },
    { name: 'Vegetarian',    category: TraitCategory.LIFESTYLE },
    // Social
    { name: 'Bro',           category: TraitCategory.SOCIAL },
    { name: 'Family-Oriented', category: TraitCategory.SOCIAL },
    { name: 'Jealous',       category: TraitCategory.SOCIAL },
    { name: 'Loner',         category: TraitCategory.SOCIAL },
    { name: 'Outgoing',      category: TraitCategory.SOCIAL },
    { name: 'Romantic',      category: TraitCategory.SOCIAL },
    // Infant traits — Growing Together
    { name: 'Calm (Infant)',    category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, packId: await pack('Growing Together') },
    { name: 'Clingy (Infant)',  category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, packId: await pack('Growing Together') },
    { name: 'Intense (Infant)', category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, packId: await pack('Growing Together') },
    { name: 'Wiggly',           category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, packId: await pack('Growing Together') },
    { name: 'Cautious (Infant)',category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, packId: await pack('Growing Together') },
    // Toddler traits — base game
    { name: 'Angelic',          category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Charmer',          category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Clingy (Toddler)', category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Fussy',            category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Independent',      category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Inquisitive',      category: TraitCategory.HOBBY,     minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Silly',            category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Wild',             category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
  ]

  for (const t of personalityTraitSeed) {
    await prisma.personalityTrait.upsert({ where: { name: t.name }, update: {}, create: t })
  }

  // ── Non-personality Traits ────────────────────────────────────────────────
  const traitSeed: Array<{ name: string; type: TraitType; packId?: string }> = [
    // Bonus traits
    { name: 'Physically Gifted',  type: TraitType.BONUS },
    { name: 'Muser',              type: TraitType.BONUS },
    { name: 'Dastardly',          type: TraitType.BONUS },
    { name: 'Domestic',           type: TraitType.BONUS },
    { name: 'Essence of Flavor',  type: TraitType.BONUS },
    { name: 'Frugal (Bonus)',     type: TraitType.BONUS },
    { name: 'Savant (Bonus)',     type: TraitType.BONUS },
    { name: 'Fertile',            type: TraitType.BONUS },
    { name: 'One With Nature',    type: TraitType.BONUS },
    { name: 'Socially Gifted',    type: TraitType.BONUS },
    // Reward traits
    { name: 'Business Savvy',     type: TraitType.REWARD },
    { name: 'Connections',        type: TraitType.REWARD },
    { name: 'Creative Visionary', type: TraitType.REWARD },
    { name: 'Entrepreneurial',    type: TraitType.REWARD },
    { name: 'Forever Fresh',      type: TraitType.REWARD },
    { name: 'Frugal',             type: TraitType.REWARD },
    { name: 'Gym Rat',            type: TraitType.REWARD },
    { name: 'Handy',              type: TraitType.REWARD },
    { name: 'Incredibly Friendly',type: TraitType.REWARD },
    { name: 'Inspired',           type: TraitType.REWARD },
    { name: 'Long Lived',         type: TraitType.REWARD },
    { name: 'Mentor',             type: TraitType.REWARD },
    { name: 'Never Weary',        type: TraitType.REWARD },
    { name: 'Nerd Brain',         type: TraitType.REWARD },
    { name: 'No Jealousy',        type: TraitType.REWARD },
    { name: 'Player',             type: TraitType.REWARD },
    { name: 'Savant',             type: TraitType.REWARD },
    { name: 'Seldom Sleepy',      type: TraitType.REWARD },
    { name: 'Steel Bladder',      type: TraitType.REWARD },
    { name: 'Super Green Thumb',  type: TraitType.REWARD },
    // Death traits
    { name: 'Ghost (Old Age)',       type: TraitType.DEATH },
    { name: 'Ghost (Drowning)',      type: TraitType.DEATH },
    { name: 'Ghost (Fire)',          type: TraitType.DEATH },
    { name: 'Ghost (Electrocution)', type: TraitType.DEATH },
    { name: 'Ghost (Hunger)',        type: TraitType.DEATH },
    { name: 'Ghost (Overexertion)',  type: TraitType.DEATH },
    { name: 'Ghost (Embarrassment)', type: TraitType.DEATH },
    { name: 'Ghost (Anger)',         type: TraitType.DEATH },
    { name: 'Ghost (Laughter)',      type: TraitType.DEATH },
    { name: 'Ghost (Cowplant)',      type: TraitType.DEATH },
    { name: 'Ghost (Pufferfish)',    type: TraitType.DEATH },
    { name: 'Ghost (Murphy Bed)',    type: TraitType.DEATH },
    { name: 'Ghost (Steam)',         type: TraitType.DEATH },
    { name: 'Ghost (Poison)',        type: TraitType.DEATH },
    { name: 'Ghost (Meteor)',        type: TraitType.DEATH },
  ]

  for (const t of traitSeed) {
    await prisma.trait.upsert({ where: { name: t.name }, update: {}, create: t })
  }

  // ── Aspirations ───────────────────────────────────────────────────────────
  const bt = async (name: string) => {
    const t = await prisma.trait.findUniqueOrThrow({ where: { name } })
    return t.id
  }

  const aspirationSeed: Array<{
    name: string
    category: AspirationCategory
    bonusTraitId?: string
    minLifeStage?: LifeStage
    maxLifeStage?: LifeStage
    packId?: string
  }> = [
    // Athletic
    { name: 'Bodybuilder',               category: AspirationCategory.ATHLETIC,    bonusTraitId: await bt('Physically Gifted'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Extreme Sports Enthusiast', category: AspirationCategory.ATHLETIC,    bonusTraitId: await bt('Physically Gifted'), minLifeStage: LifeStage.YOUNG_ADULT, packId: await pack('Outdoor Retreat') },
    // Creativity
    { name: 'Bestselling Author',        category: AspirationCategory.CREATIVITY,  bonusTraitId: await bt('Muser'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Musical Genius',            category: AspirationCategory.CREATIVITY,  bonusTraitId: await bt('Muser'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Painter Extraordinaire',    category: AspirationCategory.CREATIVITY,  bonusTraitId: await bt('Muser'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Deviance
    { name: 'Chief of Mischief',         category: AspirationCategory.DEVIANCE,    bonusTraitId: await bt('Dastardly'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Public Enemy',              category: AspirationCategory.DEVIANCE,    bonusTraitId: await bt('Dastardly'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Serial Romantic',           category: AspirationCategory.DEVIANCE,    bonusTraitId: await bt('Dastardly'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Family
    { name: 'Big Happy Family',          category: AspirationCategory.FAMILY,      bonusTraitId: await bt('Domestic'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Successful Lineage',        category: AspirationCategory.FAMILY,      bonusTraitId: await bt('Domestic'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Super Parent',              category: AspirationCategory.FAMILY,      bonusTraitId: await bt('Domestic'), minLifeStage: LifeStage.YOUNG_ADULT, packId: await pack('Parenthood') },
    // Food
    { name: 'Culinary Librarian',        category: AspirationCategory.FOOD,        bonusTraitId: await bt('Essence of Flavor'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Master Chef',               category: AspirationCategory.FOOD,        bonusTraitId: await bt('Essence of Flavor'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Master Mixologist',         category: AspirationCategory.FOOD,        bonusTraitId: await bt('Essence of Flavor'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Fortune
    { name: 'Fabulously Wealthy',        category: AspirationCategory.FORTUNE,     bonusTraitId: await bt('Frugal (Bonus)'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Mansion Baron',             category: AspirationCategory.FORTUNE,     bonusTraitId: await bt('Frugal (Bonus)'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Knowledge
    { name: 'Computer Whiz',             category: AspirationCategory.KNOWLEDGE,   bonusTraitId: await bt('Savant (Bonus)'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Nerd Brain',                category: AspirationCategory.KNOWLEDGE,   bonusTraitId: await bt('Savant (Bonus)'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Renaissance Sim',           category: AspirationCategory.KNOWLEDGE,   bonusTraitId: await bt('Savant (Bonus)'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Love
    { name: 'Hopeless Romantic',         category: AspirationCategory.LOVE,        bonusTraitId: await bt('Fertile'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Soulmate',                  category: AspirationCategory.LOVE,        bonusTraitId: await bt('Fertile'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Nature
    { name: 'Freelance Botanist',        category: AspirationCategory.NATURE,      bonusTraitId: await bt('One With Nature'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'The Curator',               category: AspirationCategory.NATURE,      bonusTraitId: await bt('One With Nature'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Outdoor Enthusiast',        category: AspirationCategory.NATURE,      bonusTraitId: await bt('One With Nature'), minLifeStage: LifeStage.YOUNG_ADULT, packId: await pack('Outdoor Retreat') },
    // Popularity
    { name: 'Friend of the World',       category: AspirationCategory.POPULARITY,  bonusTraitId: await bt('Socially Gifted'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Leader of the Pack',        category: AspirationCategory.POPULARITY,  bonusTraitId: await bt('Socially Gifted'), minLifeStage: LifeStage.YOUNG_ADULT, packId: await pack('Get Together') },
    { name: 'Party Animal',              category: AspirationCategory.POPULARITY,  bonusTraitId: await bt('Socially Gifted'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Child-only
    { name: 'Artistic Prodigy',          category: AspirationCategory.CREATIVITY,  minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD },
    { name: 'Rambunctious Scamp',        category: AspirationCategory.ATHLETIC,    minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD },
    { name: 'Social Butterfly',          category: AspirationCategory.POPULARITY,  minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD },
    { name: 'Whiz Kid',                  category: AspirationCategory.KNOWLEDGE,   minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD },
  ]

  for (const a of aspirationSeed) {
    await prisma.aspiration.upsert({ where: { name: a.name }, update: {}, create: a })
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  const skillSeed: Array<{
    name: string
    minLifeStage?: LifeStage
    maxLifeStage?: LifeStage
    maxLevel: number
    packId?: string
  }> = [
    // Toddler
    { name: 'Communication', minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, maxLevel: 5 },
    { name: 'Imagination',   minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, maxLevel: 5 },
    { name: 'Movement',      minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, maxLevel: 5 },
    { name: 'Potty',         minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, maxLevel: 3 },
    { name: 'Thinking',      minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, maxLevel: 5 },
    // Child
    { name: 'Creativity (Child)', minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD, maxLevel: 10 },
    { name: 'Mental',             minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD, maxLevel: 10 },
    { name: 'Motor',              minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD, maxLevel: 10 },
    { name: 'Social (Child)',     minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD, maxLevel: 10 },
    // Adult (Teen+)
    { name: 'Charisma',       minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Comedy',         minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Cooking',        minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Fishing',        minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Fitness',        minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Gardening',      minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Guitar',         minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Handiness',      minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Logic',          minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Mischief',       minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Painting',       minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Photography',    minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Piano',          minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Programming',    minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Rocket Science', minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Video Gaming',   minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Violin',         minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Writing',        minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    // Pack skills
    { name: 'Baking',             minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Get to Work') },
    { name: 'DJ Mixing',          minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Get Together') },
    { name: 'Dancing',            minLifeStage: LifeStage.TEEN, maxLevel: 5,  packId: await pack('Get Together') },
    { name: 'Flower Arranging',   minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Seasons') },
    { name: 'Skating',            minLifeStage: LifeStage.TEEN, maxLevel: 5,  packId: await pack('Seasons') },
    { name: 'Research & Debate',  minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Discover University') },
    { name: 'Fabrication',        minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Eco Lifestyle') },
    { name: 'Cross-Stitch',       minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Cottage Living') },
    { name: 'Horseback Riding',   minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Horse Ranch') },
  ]

  for (const s of skillSeed) {
    await prisma.skill.upsert({ where: { name: s.name }, update: {}, create: s })
  }

  // ── Careers ───────────────────────────────────────────────────────────────
  const careerSeed: Array<{
    name: string
    type: CareerType
    branchAName?: string
    branchBName?: string
    packId?: string
  }> = [
    // Standard careers
    { name: 'Astronaut',       type: CareerType.STANDARD, branchAName: 'Space Ranger',       branchBName: 'Interstellar Smuggler' },
    { name: 'Athlete',         type: CareerType.STANDARD, branchAName: 'Professional Athlete', branchBName: 'Coach' },
    { name: 'Business',        type: CareerType.STANDARD, branchAName: 'Management',          branchBName: 'Investor' },
    { name: 'Criminal',        type: CareerType.STANDARD, branchAName: 'Boss',                branchBName: 'Oracle' },
    { name: 'Culinary',        type: CareerType.STANDARD, branchAName: 'Chef',                branchBName: 'Mixologist' },
    { name: 'Entertainer',     type: CareerType.STANDARD, branchAName: 'Musician',            branchBName: 'Comedian' },
    { name: 'Painter',         type: CareerType.STANDARD, branchAName: 'Master of the Real',  branchBName: 'Patron of the Arts' },
    { name: 'Secret Agent',    type: CareerType.STANDARD, branchAName: 'Villain',             branchBName: 'Diamond Agent' },
    { name: 'Style Influencer',type: CareerType.STANDARD, branchAName: 'Stylist',             branchBName: 'Trend Setter' },
    { name: 'Tech Guru',       type: CareerType.STANDARD, branchAName: 'eSport Gamer',        branchBName: 'Start-Up Entrepreneur' },
    { name: 'Writer',          type: CareerType.STANDARD, branchAName: 'Author',              branchBName: 'Journalist' },
    // Active careers
    { name: 'Doctor',          type: CareerType.ACTIVE, packId: await pack('Get to Work') },
    { name: 'Detective',       type: CareerType.ACTIVE, packId: await pack('Get to Work') },
    { name: 'Scientist',       type: CareerType.ACTIVE, packId: await pack('Get to Work') },
    // Part-time
    { name: 'Barista',         type: CareerType.PART_TIME },
    { name: 'Fast Food Employee', type: CareerType.PART_TIME },
    { name: 'Manual Laborer',  type: CareerType.PART_TIME },
    { name: 'Retail Employee', type: CareerType.PART_TIME },
  ]

  for (const c of careerSeed) {
    await prisma.career.upsert({ where: { name: c.name }, update: {}, create: c })
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
