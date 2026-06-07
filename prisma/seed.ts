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
    { name: 'Get Famous',           type: PackType.EXPANSION,  icon: '🎬', code: 'EP06',  imageUrl: SPRITE('EP06') },
    { name: 'Island Living',        type: PackType.EXPANSION,  icon: '🏝️', code: 'EP07',  imageUrl: SPRITE('EP07') },
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
    { name: 'Enchanted by Nature',  type: PackType.EXPANSION,  icon: '🧚', code: 'EP19',  imageUrl: SPRITE('EP19') },
    { name: 'Adventure Awaits',     type: PackType.EXPANSION,  icon: '🗺️', code: 'EP20',  imageUrl: SPRITE('EP20') },
    { name: 'Royalty & Legacy',     type: PackType.EXPANSION,  icon: '👑', code: 'EP21',  imageUrl: SPRITE('EP21') },
    { name: 'Outdoor Retreat',      type: PackType.GAME_PACK,  icon: '🏕️', code: 'GP01',  imageUrl: SPRITE('GP01') },
    { name: 'Spa Day',              type: PackType.GAME_PACK,  icon: '🧖', code: 'GP02',  imageUrl: SPRITE('GP02') },
    { name: 'Dine Out',             type: PackType.GAME_PACK,  icon: '🍽️', code: 'GP03',  imageUrl: SPRITE('GP03') },
    { name: 'Vampires',             type: PackType.GAME_PACK,  icon: '🧛', code: 'GP04',  imageUrl: SPRITE('GP04') },
    { name: 'Parenthood',           type: PackType.GAME_PACK,  icon: '👨‍👩‍👧', code: 'GP05',  imageUrl: SPRITE('GP05') },
    { name: 'Jungle Adventure',     type: PackType.GAME_PACK,  icon: '🌴', code: 'GP06',  imageUrl: SPRITE('GP06') },
    { name: 'StrangerVille',        type: PackType.GAME_PACK,  icon: '👽', code: 'GP07',  imageUrl: SPRITE('GP07') },
    { name: 'Realm of Magic',       type: PackType.GAME_PACK,  icon: '🔮', code: 'GP08',  imageUrl: SPRITE('GP08') },
    { name: 'Star Wars: Journey to Batuu', type: PackType.GAME_PACK, icon: '⚔️', code: 'GP09', imageUrl: SPRITE('GP09') },
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
    { name: 'Backyard Stuff',       type: PackType.STUFF_PACK, icon: '🌳', code: 'SP08',  imageUrl: SPRITE('SP08') },
    { name: 'Vintage Glamour Stuff',type: PackType.STUFF_PACK, icon: '💄', code: 'SP09',  imageUrl: SPRITE('SP09') },
    { name: 'Bowling Night Stuff',  type: PackType.STUFF_PACK, icon: '🎳', code: 'SP10',  imageUrl: SPRITE('SP10') },
    { name: 'Fitness Stuff',        type: PackType.STUFF_PACK, icon: '🏋️', code: 'SP11',  imageUrl: SPRITE('SP11') },
    { name: 'Toddler Stuff',        type: PackType.STUFF_PACK, icon: '🎠', code: 'SP12',  imageUrl: SPRITE('SP12') },
    { name: 'Laundry Day Stuff',    type: PackType.STUFF_PACK, icon: '🧺', code: 'SP13',  imageUrl: SPRITE('SP13') },
    { name: 'My First Pet Stuff',   type: PackType.STUFF_PACK, icon: '🐹', code: 'SP14',  imageUrl: SPRITE('SP14') },
    { name: 'Moschino Stuff',       type: PackType.STUFF_PACK, icon: '👗', code: 'SP15',  imageUrl: SPRITE('SP15') },
    { name: 'Tiny Living Stuff',    type: PackType.STUFF_PACK, icon: '🏠', code: 'SP16',  imageUrl: SPRITE('SP16') },
    { name: 'Nifty Knitting Stuff', type: PackType.STUFF_PACK, icon: '🧶', code: 'SP17',  imageUrl: SPRITE('SP17') },
    { name: 'Paranormal Stuff',     type: PackType.STUFF_PACK, icon: '👻', code: 'SP18',  imageUrl: SPRITE('SP18') },
    { name: 'Home Chef Hustle Stuff',type: PackType.STUFF_PACK, icon: '🧑‍🍳', code: 'SP46',  imageUrl: SPRITE('SP46') },
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
    { name: 'Carnaval Streetwear Kit', type: PackType.KIT,     icon: '🎉', code: 'SP30',  imageUrl: SPRITE('SP30') },
    { name: 'Decor to the Max Kit', type: PackType.KIT,        icon: '🖼️', code: 'SP31',  imageUrl: SPRITE('SP31') },
    { name: 'Little Campers Kit',   type: PackType.KIT,        icon: '⛺', code: 'SP33',  imageUrl: SPRITE('SP33') },
    { name: 'First Fits Kit',       type: PackType.KIT,        icon: '👶', code: 'SP34',  imageUrl: SPRITE('SP34') },
    { name: 'Bathroom Clutter Kit', type: PackType.KIT,        icon: '🪥', code: 'SP39',  imageUrl: SPRITE('SP39') },
    { name: 'Greenhouse Haven Kit', type: PackType.KIT,        icon: '🌱', code: 'SP40',  imageUrl: SPRITE('SP40') },
    { name: 'Basement Treasures Kit', type: PackType.KIT,      icon: '📦', code: 'SP41',  imageUrl: SPRITE('SP41') },
    { name: 'Grunge Revival Kit',   type: PackType.KIT,        icon: '🎸', code: 'SP42',  imageUrl: SPRITE('SP42') },
    { name: 'Book Nook Kit',        type: PackType.KIT,        icon: '📚', code: 'SP43',  imageUrl: SPRITE('SP43') },
    { name: 'Poolside Splash Kit',  type: PackType.KIT,        icon: '🏊', code: 'SP44',  imageUrl: SPRITE('SP44') },
    { name: 'Modern Luxe Kit',      type: PackType.KIT,        icon: '✨', code: 'SP45',  imageUrl: SPRITE('SP45') },
    { name: 'Castle Estate Kit',    type: PackType.KIT,        icon: '🏰', code: 'SP47',  imageUrl: SPRITE('SP47') },
    { name: 'Goth Galore Kit',      type: PackType.KIT,        icon: '🖤', code: 'SP48',  imageUrl: SPRITE('SP48') },
    { name: 'Urban Homage Kit',     type: PackType.KIT,        icon: '🧢', code: 'SP50',  imageUrl: SPRITE('SP50') },
    { name: 'Party Essentials Kit', type: PackType.KIT,        icon: '🎊', code: 'SP51',  imageUrl: SPRITE('SP51') },
    { name: 'Riviera Retreat Kit',  type: PackType.KIT,        icon: '⛱️', code: 'SP52',  imageUrl: SPRITE('SP52') },
    { name: 'Cozy Bistro Kit',      type: PackType.KIT,        icon: '☕', code: 'SP53',  imageUrl: SPRITE('SP53') },
    { name: 'Artist Studio Kit',    type: PackType.KIT,        icon: '🖌️', code: 'SP54',  imageUrl: SPRITE('SP54') },
    { name: 'Storybook Nursery Kit',type: PackType.KIT,        icon: '📖', code: 'SP55',  imageUrl: SPRITE('SP55') },
    { name: 'Sweet Slumber Party Kit', type: PackType.KIT,     icon: '💤', code: 'SP56',  imageUrl: SPRITE('SP56') },
    { name: 'Cozy Kitsch Kit',      type: PackType.KIT,        icon: '🏡', code: 'SP57',  imageUrl: SPRITE('SP57') },
    { name: 'Comfy Gamer Kit',      type: PackType.KIT,        icon: '🎮', code: 'SP58',  imageUrl: SPRITE('SP58') },
    { name: 'Secret Sanctuary Kit', type: PackType.KIT,        icon: '🌿', code: 'SP59',  imageUrl: SPRITE('SP59') },
    { name: 'Casanova Cave Kit',    type: PackType.KIT,        icon: '🕯️', code: 'SP60',  imageUrl: SPRITE('SP60') },
    { name: 'Refined Living Room Kit', type: PackType.KIT,     icon: '🛋️', code: 'SP61',  imageUrl: SPRITE('SP61') },
    { name: 'Business Chic Kit',    type: PackType.KIT,        icon: '💼', code: 'SP62',  imageUrl: SPRITE('SP62') },
    { name: 'Sleek Bathroom Kit',   type: PackType.KIT,        icon: '🚿', code: 'SP63',  imageUrl: SPRITE('SP63') },
    { name: 'Sweet Allure Kit',     type: PackType.KIT,        icon: '🍬', code: 'SP64',  imageUrl: SPRITE('SP64') },
    { name: 'Restoration Workshop Kit', type: PackType.KIT,    icon: '🔨', code: 'SP65',  imageUrl: SPRITE('SP65') },
    { name: 'Golden Years Kit',     type: PackType.KIT,        icon: '🌟', code: 'SP66',  imageUrl: SPRITE('SP66') },
    { name: 'Kitchen Clutter Kit',  type: PackType.KIT,        icon: '🍳', code: 'SP67',  imageUrl: SPRITE('SP67') },
    { name: "Spongebob's House Kit",type: PackType.KIT,        icon: '🧽', code: 'SP68',  imageUrl: SPRITE('SP68') },
    { name: 'Autumn Apparel Kit',   type: PackType.KIT,        icon: '🍁', code: 'SP69',  imageUrl: SPRITE('SP69') },
    { name: "Spongebob Kid's Room Kit", type: PackType.KIT,    icon: '🐚', code: 'SP70',  imageUrl: SPRITE('SP70') },
    { name: 'Grange Mudroom Kit',   type: PackType.KIT,        icon: '🥾', code: 'SP71',  imageUrl: SPRITE('SP71') },
    { name: 'Essential Glam Kit',   type: PackType.KIT,        icon: '💅', code: 'SP72',  imageUrl: SPRITE('SP72') },
    { name: 'Modern Retreat Kit',   type: PackType.KIT,        icon: '🪴', code: 'SP73',  imageUrl: SPRITE('SP73') },
    { name: 'Garden to Table Kit',  type: PackType.KIT,        icon: '🥕', code: 'SP74',  imageUrl: SPRITE('SP74') },
    { name: 'Wonderland Playroom Kit', type: PackType.KIT,     icon: '🪄', code: 'SP75',  imageUrl: SPRITE('SP75') },
    { name: 'Silver Screen Style Kit', type: PackType.KIT,     icon: '🎥', code: 'SP76',  imageUrl: SPRITE('SP76') },
    { name: 'Tea Time Solarium Kit',type: PackType.KIT,        icon: '🍵', code: 'SP77',  imageUrl: SPRITE('SP77') },
    { name: 'Prairie Dreams Kit',   type: PackType.KIT,        icon: '🌾', code: 'SP81',  imageUrl: SPRITE('SP81') },
    { name: 'Yard Charm Kit',       type: PackType.KIT,        icon: '🌻', code: 'SP82',  imageUrl: SPRITE('SP82') },
  ]

  for (const p of packSeed) {
    await prisma.pack.upsert({
      where: { code: p.code },
      update: { name: p.name, type: p.type, icon: p.icon, imageUrl: p.imageUrl ?? null },
      create: p,
    })
  }

  const pack = async (name: string) => {
    const p = await prisma.pack.findUniqueOrThrow({ where: { name } })
    return p.id
  }

  const packByCode = async (code: string) =>
    (await prisma.pack.findUniqueOrThrow({ where: { code } })).id

  // ── Personality Traits ────────────────────────────────────────────────────
  const personalityTraitSeed: Array<{
    name: string
    description?: string
    category: TraitCategory
    minLifeStage?: LifeStage
    maxLifeStage?: LifeStage
    packId?: string
  }> = [
    // ── Base game — Child+ ──────────────────────────────────────────────────
    // Emotional
    { name: 'Cheerful',     category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.CHILD, description: 'These Sims tend to be Happier than other Sims.' },
    { name: 'Creative',     category: TraitCategory.HOBBY,     minLifeStage: LifeStage.CHILD, description: 'These Sims tend to be Inspired, can Share Creative Ideas with other Sims, and may become upset if they\'re not creative for a period of time.' },
    { name: 'Erratic',      category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.CHILD, description: 'These Sims can Talk to themselves and have unpredictable Emotions.' },
    { name: 'Genius',       category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.CHILD, description: 'These Sims tend to be Focused, can Share Ideas with other Sims, and may become upset if they haven\'t improved their Mental Skills for some time.' },
    { name: 'Gloomy',       category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.CHILD, description: 'These Sims tend to be Sad, can Share Melancholy Thoughts to other Sims, and while sad, gain a boost to their Creative Skill.' },
    { name: 'Goofball',     category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.CHILD, description: 'These Sims tend to be Playful.' },
    { name: 'Hot-Headed',   category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.CHILD, description: 'These Sims tend to be Angry, can Rile up other Sims, and become Angry when targeted with Mischief.' },
    { name: 'Self-Assured', category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.CHILD, description: 'These Sims tend to be Confident.' },
    // Hobby
    { name: 'Art Lover',      category: TraitCategory.HOBBY, minLifeStage: LifeStage.CHILD, description: 'These Sims gain powerful Moodlets from Viewing works of art and can Admire Art and Discuss Art in unique ways.' },
    { name: 'Bookworm',       category: TraitCategory.HOBBY, minLifeStage: LifeStage.CHILD, description: 'These Sims gain powerful Moodlets from reading Books and can Analyze Books and Discuss Books in unique ways.' },
    { name: 'Geek',           category: TraitCategory.HOBBY, minLifeStage: LifeStage.CHILD, description: 'These Sims become Happy when Reading Sci-Fi or Playing Video Games, may become Tense if they haven\'t played much, are better at finding Collectibles, and can Discuss Geek Things with other Geek Sims.' },
    { name: 'Loves Outdoors', category: TraitCategory.HOBBY, minLifeStage: LifeStage.CHILD, description: 'These Sims can Enthuse about Nature to other Sims and become Happy when Outdoors.' },
    { name: 'Music Lover',    category: TraitCategory.HOBBY, minLifeStage: LifeStage.CHILD, description: 'These Sims gain powerful Moodlets and boost their Fun Need when Listening to Music and become Happy when playing instruments.' },
    // Lifestyle
    { name: 'Active',        category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.CHILD, description: 'These Sims tend to be Energized, can Pump Up other Sims, and may become upset if they don\'t exercise for a period of time.' },
    { name: 'Glutton',       category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.CHILD, description: 'These Sims have a greater negative reaction to Hunger, always enjoy eating, no matter the quality of the food, and will eat Spoiled Food.' },
    { name: 'Kleptomaniac',  category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.CHILD, description: 'These Sims don\'t mind "borrowing" things from others with a simple swipe, but will get Tense when they have not swiped anything in a while.' },
    { name: 'Lazy',          category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.CHILD, description: 'These Sims gain powerful Moodlets from Watching TV or Napping as well as from Comfortable furniture, become Fatigued more quickly from exercise, and grow Tense when performing household chores.' },
    { name: 'Neat',          category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.CHILD, description: 'These Sims become Happy and have Fun when performing household chores, can have a Cleaning Frenzy, and become really Uncomfortable in dirty surroundings.' },
    { name: 'Perfectionist', category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.CHILD, description: 'These Sims take longer to craft items but tend to make them higher quality, gain powerful Moodlets after crafting a high quality item, and gain negative Moodlets after crafting a low quality item.' },
    { name: 'Slob',          category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.CHILD, description: 'These Sims are not affected by dirty surroundings, make household items dirtier faster, and can Rummage for Food in garbage.' },
    // Social
    { name: 'Evil',  category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.CHILD, description: 'These Sims become Happy around Sims with negative Moodlets, can Laugh Maniacally and Discuss Evil Plans, and become Angry when interacting with Good Sims.' },
    { name: 'Good',  category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.CHILD, description: 'These Sims become Happy around Sims with positive Moodlets, can Donate to Charity, become Sad with interacting with Evil Sims, and can Discuss World Peace.' },
    { name: 'Loner', category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.CHILD, description: 'These Sims become Happy when alone, do not receive negative Moodlets when their Social Need is low, become Tense around strangers, and become Embarrassed more often by social rejection.' },
    { name: 'Mean',  category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.CHILD, description: 'These Sims become Happy when being Mean or Mischievous to other Sims and become Confident after winning a fight.' },
    { name: 'Outgoing', category: TraitCategory.SOCIAL, minLifeStage: LifeStage.CHILD, description: 'These Sims gain powerful Moodlets from Friendly socialization, have their Social need decay quickly, and gain more negative Moodlets when their Social need is low.' },

    // ── Base game — Teen+ ───────────────────────────────────────────────────
    { name: 'Childish',       category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'These Sims gain powerful Moodlets from watching the Kids Network, become Playful when playing with Children, and become Happy when playing with Children\'s toys.' },
    { name: 'Clumsy',         category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'These Sims tend to fail more often at physical activities and tend to laugh at failure instead of becoming upset.' },
    { name: 'Hates Children', category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'These Sims become Angry around Children, become Tense after Try for a Baby, and can be Mean to Children.' },
    { name: 'Loyal',          category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'Loyal sims value their relationships and fully commit to them. whether they are friendship, romance or even work! They avoid lying and cheating because their loved ones\' trust is very important to them.' },
    { name: 'Materialistic',  category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'These Sims can Admire and Brag about Possessions and become Sad when they haven\'t purchased a new item for a period of time.' },
    { name: 'Snob',           category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'These Sims can Critique Work on low quality items, are bored by "low brow" television, and gain Confidence around other Snob Sims.' },
    { name: 'Bro',                    category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'These Sims can Bro Hug other Bros, gain Confidence around other Bros, and become Energized from Watching Sports.' },
    { name: 'Jealous',                category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'These Sims get Jealous more easily than other Sims. They gain a boost of Confidence from being around their significant other, but get Tense if they haven\'t seen them recently.' },
    { name: 'Practice Makes Perfect', category: TraitCategory.LIFESTYLE,  minLifeStage: LifeStage.TEEN, description: 'Sims with this trait learn skills faster, even if they are a bit slower at first.' },

    // ── Base game — Young Adult+ ────────────────────────────────────────────
    { name: 'Ambitious',     category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.YOUNG_ADULT, description: 'These Sims gain powerful Moodlets from career success, gain negative Moodlets from career failure, and may become Tense if not promoted.' },
    { name: 'Family-Oriented', category: TraitCategory.SOCIAL,  minLifeStage: LifeStage.YOUNG_ADULT, description: 'These Sims become Happy around family members, become Sad if they don\'t interact with family for a period of time, and can Boast about Family.' },
    { name: 'Foodie',        category: TraitCategory.HOBBY,     minLifeStage: LifeStage.YOUNG_ADULT, description: 'These Sims become Happy and have Fun when eating good food, become Uncomfortable when eating bad food, and can Watch Cooking Shows for ideas.' },
    { name: 'Noncommittal',  category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.YOUNG_ADULT, description: 'These Sims become Tense after a while in the same job or relationship, become Happy when they Quit a Job or Break Off a relationship, take longer to Propose, and can Discuss their Fear of Commitment.' },
    { name: 'Romantic',      category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.YOUNG_ADULT, description: 'These Sims tend to be Flirty and may become Sad if they don\'t have any Romantic social interactions for a period of time.' },

    // ── Cats & Dogs ─────────────────────────────────────────────────────────
    { name: 'Cat Lover', category: TraitCategory.SOCIAL, minLifeStage: LifeStage.CHILD, description: 'These Sims tend to make cats their companions, preferring the company of cats to other Sims.',                                     packId: await pack('Cats & Dogs') },
    { name: 'Dog Lover', category: TraitCategory.SOCIAL, minLifeStage: LifeStage.CHILD, description: 'These Sims love to be near dogs. They will gain relationships faster with dogs and socialize with dogs more than the average Sim.', packId: await pack('Cats & Dogs') },

    // ── City Living ──────────────────────────────────────────────────────────
    { name: 'Unflirty', category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'These Sims get Tense around Flirty Sims and seldom get Flirty themselves. It\'s difficult for them to be Romantic in public.', packId: await pack('City Living') },

    // ── Cottage Living ───────────────────────────────────────────────────────
    { name: 'Animal Enthusiast',  category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.CHILD, description: 'These Sims are obsessed with animals, and will seek their company often. They will have an easier time caring for animals and getting closer to them.', packId: await pack('Cottage Living') },
    { name: 'Lactose Intolerant', category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.CHILD, description: 'These Sims will become sick if they eat dairy, but will feel great if they have avoided it for a while.',                                            packId: await pack('Cottage Living') },

    // ── Eco Lifestyle ────────────────────────────────────────────────────────
    { name: 'Green Fiend',      category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.CHILD, description: 'These Sims are happiest when living on a green street and will continuously work towards making their environment more eco-friendly.',                                                                                         packId: await pack('Eco Lifestyle') },
    { name: 'Recycle Disciple', category: TraitCategory.HOBBY,     minLifeStage: LifeStage.CHILD, description: 'These Sims are rabid recyclers that benefit from recycling and rummaging for bits and pieces, but should they go too long without indulging in their hobby...',                                                               packId: await pack('Eco Lifestyle') },
    { name: 'Freegan',          category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'These Sims reject consumerism and prefer to reduce wasteful spending by any means. They enjoy finding re-used or thrown away goods and foods. In fact, they have the best luck at finding the highest-quality treasures in Dumpsters! They may become tense or uncomfortable if they spend too much time earning or spending Simoleons.', packId: await pack('Eco Lifestyle') },
    { name: 'Maker',            category: TraitCategory.HOBBY,     minLifeStage: LifeStage.TEEN, description: 'These Sims become happy when making things. They become sad when it\'s been too long since completing a project on a Fabricator, Candlemaking Station, Juice Fizzer, or Woodworking Table. They do not receive negative effects from crafting or repair failures.',                                packId: await pack('Eco Lifestyle') },

    // ── For Rent ─────────────────────────────────────────────────────────────
    { name: 'Child of the Village', category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'These Sims love feeling anchored to their community and Tomarani culture. Keeping in touch with loved ones and engaging in activities that remind them of home is important for being Happy.',                                                                     packId: await pack('For Rent') },
    { name: 'Cringe',               category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'Sims who are obnoxiously oblivious and oftentimes met with polarizing reactions. Cringe Sims can be socially unaware of their surroundings at times, but have an adorable enthusiasm for life.',                                                               packId: await pack('For Rent') },
    { name: 'Generous',             category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'Caring, empathetic, and patient. These Sims are happiest when offering their time and money to help others. Everyone loves Generous Sims, but they can be a little too brazen with their donations.',                                                          packId: await pack('For Rent') },
    { name: 'Nosy',                 category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'Sims who thrive on gossip, snooping, and spying. They have incredibly poor boundaries and don\'t quite understand what personal space is, but they will discover secrets by any means necessary.',                                                             packId: await pack('For Rent') },

    // ── Get Famous ───────────────────────────────────────────────────────────
    { name: 'Self-Absorbed', category: TraitCategory.SOCIAL, minLifeStage: LifeStage.TEEN, description: 'These Sims are all about themselves! They can Fish for Compliments, are more excited when receiving a present, and may become tense when they haven\'t gotten enough attention. The celebrity spotlight is something they generally relish. After all, everyone else should love them as much as they do themselves, right?', packId: await pack('Get Famous') },

    // ── Get Together ─────────────────────────────────────────────────────────
    { name: 'Dance Machine', category: TraitCategory.HOBBY,   minLifeStage: LifeStage.TEEN, description: 'These Sims can\'t wait to get down, boogie, and party all night! When at venues like Bars, Nightclubs, and Lounges, these Sims can get a burst of energy with the Party Time interaction.', packId: await pack('Get Together') },
    { name: 'Insider',       category: TraitCategory.SOCIAL,  minLifeStage: LifeStage.CHILD, description: 'These Sims love being in Clubs, and tend to be happiest when surrounded by their friends.',                                                                                                                                  packId: await pack('Get Together') },

    // ── High School Years ────────────────────────────────────────────────────
    { name: 'Overachiever',   category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'These Sims tend to raise their skills faster and are happy when they finish work tasks, but are a little harder to get along with as friends.',                                                                                                                  packId: await pack('High School Years') },
    { name: 'Party Animal',   category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'These Sims tend to enjoy parties and letting every other Sim know by hyping up a crowd and performing party tricks.',                                                                                                                                          packId: await pack('High School Years') },
    { name: 'Socially Awkward', category: TraitCategory.SOCIAL,  minLifeStage: LifeStage.TEEN, description: 'These Sims tend to struggle in social situations and build charisma more slowly, but gain powerful Moodlets and Sentiments when they are able to overcome their awkwardness and accompanying nervousness to form close relationships.',                         packId: await pack('High School Years') },

    // ── Horse Ranch ──────────────────────────────────────────────────────────
    { name: 'Horse Lover', category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.CHILD, packId: await pack('Horse Ranch') },
    { name: 'Rancher',     category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.YOUNG_ADULT, packId: await pack('Horse Ranch') },

    // ── Island Living ────────────────────────────────────────────────────────
    { name: 'Child of the Islands', category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'These Sims experience a spiritual connection to islands of Sulani. Honor the islands by partaking in their culture, summon powerful elementals and reap the rewards of their blessings—or the consequences of their disfavor.', packId: await pack('Island Living') },
    { name: 'Child of the Ocean',   category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'Answer the call of the ocean! Sims with this trait will prefer water related activities and feel closer to denizens of the sea.',                                                                                                packId: await pack('Island Living') },

    // ── Outdoor Retreat ──────────────────────────────────────────────────────
    { name: 'Squeamish', category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.CHILD, description: 'Squeamish Sims are nauseated by the sight of creepy crawlies, vomiting, violence and death. These Sims become Uncomfortable near anything dirty.', packId: await pack('Outdoor Retreat') },

    // ── Snowy Escape ─────────────────────────────────────────────────────────
    { name: 'Adventurous', category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.CHILD, description: 'These Sims seek out new and unique experiences.',                                                                                                                                                                                     packId: await pack('Snowy Escape') },
    { name: 'Proper',      category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.CHILD, description: 'These Sims tend to disapprove of other Sims\' improper behavior such as Mean or Mischievous socials, but find themselves happier in Formal Outfits and have a much easier time with Friendly and Romantic socials.',                   packId: await pack('Snowy Escape') },

    // ── Spa Day ──────────────────────────────────────────────────────────────
    { name: 'High Maintenance', category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'These Sims require extra work to keep in good condition. Their problems sometimes appear trivial, and may even appear out of the blue. These struggles can be remedied through mindful habits, which puts them in a state of catharsis.', packId: await pack('Spa Day') },

    // ── StrangerVille ────────────────────────────────────────────────────────
    { name: 'Paranoid', category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'Paranoid Sims feel that danger is around every corner, and that people are always talking about them. Paranoid Sims feel a sense of security while hanging out in basements.', packId: await pack('StrangerVille') },

    // ── Vegetarian (City Living) ─────────────────────────────────────────────
    { name: 'Vegetarian', category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.CHILD, description: 'These Sims will actively avoid eating foods that contain meat products and can become sick if they eat such foods.', packId: await pack('City Living') },

    // ── Lovestruck ───────────────────────────────────────────────────────────
    { name: 'Lovebug',              category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'Sims with this trait are constantly swept up in the whirlwind of romance. They fall in love easily, often wearing their hearts on their sleeves.',                                                                                                                                               packId: await pack('Lovestruck') },
    { name: 'Romantically Reserved', category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'These Sims often tread carefully in the realm of love, preferring to take their time and build solid emotional connections before jumping headfirst into romance.',                                                                                                                            packId: await pack('Lovestruck') },

    // ── Life & Death ─────────────────────────────────────────────────────────
    { name: 'Chased by Death', category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'Chased by Death sims know that death follows their every move. While risky and dangerous behaviors may have deadly consequences, frequent near-death experiences give these Sims a desire to live each day to the fullest and progress along their soul\'s journey faster. Keenly aware of their own mortality, these Sims feel best when they are achieving something meaningful with their limited time left.', packId: await pack('Life & Death') },
    { name: 'Macabre',         category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'Embrace your inner darkness - and your occasional intrusions of light. Macabre Sims are all about being their best, unique Sim self while still reveling in all that life (and the afterlife) has to offer.',                                                                                        packId: await pack('Life & Death') },
    { name: 'Skeptical',       category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'Not entirely trusting of the majority of things you see or hear? Skeptical Sims like to challenge the universe to provide concrete proof that something is indeed as it might appear.',                                                                                                             packId: await pack('Life & Death') },

    // ── Crystal Creations ────────────────────────────────────────────────────
    { name: 'Grouch', category: TraitCategory.SOCIAL, minLifeStage: LifeStage.TEEN, description: 'These Sims raise their Mischief skill faster by playing pranks and bothering others with their surprises.', packId: await pack('Crystal Creations') },

    // ── Businesses & Hobbies ─────────────────────────────────────────────────
    { name: 'Idealist', category: TraitCategory.SOCIAL, minLifeStage: LifeStage.TEEN, description: 'These Sims hold high moral standards and strive for a better world guided by their values and principles. They are committed to doing what they believe is right, even when it\'s challenging.', packId: await pack('Businesses & Hobbies') },
    { name: 'Shady',    category: TraitCategory.SOCIAL, minLifeStage: LifeStage.TEEN, description: 'These Sims excel at exploiting situations and bending rules for personal gain, often without regard for conventional ethics or fairness. They thrive in mischievous activities and can influence others to adopt their way of living.',                                                          packId: await pack('Businesses & Hobbies') },

    // ── Adventure Awaits ─────────────────────────────────────────────────────
    { name: 'Competitive', category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'Competitive Sims have to be the best at anything they put their sweaty focus on, especially games and physical activities. They\'re all about winning, so they take losing really personally. Depending on how they manage their Competitive Spirit, these Sims can either become an inspiration for Sim excellence or bask in the toxic pits of the abyss and become the ultimate sore loser!', packId: await pack('Adventure Awaits') },

    // ── Enchanted by Nature ──────────────────────────────────────────────────
    { name: 'Disruptive',  category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'Disruptive Sims are driven to interact with the world by messing with it. They can spread interpersonal chaos by Giving Bad Balance Advice or stick it to nature by Disrupting Plants. Disruptive Sims build Mischief Skill faster but are slower to regain Balance than most Sims.',                                                                                                                  packId: await pack('Enchanted by Nature') },
    { name: 'Mystical',    category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'Feeling a strong affinity for both the natural and supernatural, Mystical Sims see higher purpose in living harmoniously in each world and sharing that with other Sims. These Sims learn Apothecary and Gardening Skills faster and have an easier time building friendships with Occult Sims. Mystical Sims can offer to Grant a Sacred Blessing to other Sims, which increases Balance for both Sims if accepted.', packId: await pack('Enchanted by Nature') },
    { name: 'Plant Lover', category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'Plant Lover Sims treat each and every plant like the little Sim they are. Being a friend to plants is not always easy on a Plant Lover\'s emotions, but luckily these Sims don\'t need any skill to share their special interest, just a big heart!',                                                                                                                                            packId: await pack('Enchanted by Nature') },

    // ── Infant traits — base game ────────────────────────────────────────────
    { name: 'Calm',              category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, description: 'These Sims like to watch the world, are less likely to cry or become angry, and don\'t grow tired of activities as easily as other infants; however, they are less likely to explore the world on their own.' },
    { name: 'Cautious',          category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, description: 'These Sims appreciate the familiar but are slow to warm up to new experiences, locations, and Sims.' },
    { name: 'Clingy',            category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT },
    { name: 'Intense',           category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, description: 'These Sims have big emotions and are easily entertained, but they are also more difficult to calm when in a bad mood.' },
    { name: 'Sensitive',         category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, description: 'These Sims are prone to diaper rash, are often picky with food, and can more easily become overstimulated by too much play and social interaction; however, they also rest more peacefully through the night when soothed.' },
    { name: 'Sunny',             category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, description: 'These Sims are bursting with smiles and giggles and enjoy engaging with other Sims, but they do require more social attention.' },
    { name: 'Wiggly',            category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, description: 'These Sims are always on the go and want to play and move about; however they often struggle to fall asleep or pay attention for extended periods of time.' },

    // ── Toddler traits — base game ───────────────────────────────────────────
    { name: 'Angelic',          category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'Idyllic, easygoing Toddlers. They are never defiant and they don\'t throw a tantrum. They can easily talk to strangers.' },
    { name: 'Charmer',          category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'These Toddlers love to socialize. They earn Communication skill faster, and don\'t suffer Stranger Danger from strangers. They can Share the Love with other Sims.' },
    { name: 'Clingy',           category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'These shy Toddlers avoid Sims outside the household and get sad if left behind. They gain extra skill when taught. And they recover faster from bad moods when Comforted.' },
    { name: 'Fussy',            category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'Tiny trouble-makers who love to Cry, cause trouble, and Throw Fits. But being noticed makes them Happy and helps them overcome negative Moodlets.' },
    { name: 'Independent',      category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'These Toddlers love their freedom, and don\'t like to take orders from caregivers. They gain extra skill when they are left alone, and need less Attention than other Toddlers.' },
    { name: 'Inquisitive',      category: TraitCategory.HOBBY,     minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'Curious explorers. These Toddlers gain Thinking skill slightly faster. They are happiest when learning something, and sad if they haven\'t learned anything lately.' },
    { name: 'Silly',            category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'Goofy and curious. These Toddlers love to tell jokes and get Playful. They earn Imagination skill slightly faster.' },
    { name: 'Wild',             category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'Spirited and full of Energy. These Toddlers love to explore and get Energized. They earn Movement skill slightly faster. They get sad if they haven\'t been outside in a while.' },
  ]

  await prisma.personalityTrait.deleteMany({
    where: { name: { in: ['Calm (Infant)', 'Cautious (Infant)', 'Intense (Infant)', 'Clingy (Infant)', 'Clingy (Toddler)'] } },
  })

  for (const t of personalityTraitSeed) {
    await prisma.personalityTrait.upsert({
      where:  { name_minLifeStage: { name: t.name, minLifeStage: t.minLifeStage as LifeStage } },
      update: { description: t.description ?? null, packId: t.packId ?? null, minLifeStage: t.minLifeStage ?? null, maxLifeStage: t.maxLifeStage ?? null },
      create: t,
    })
  }

  // ── Personality Trait Conflicts ───────────────────────────────────────────
  const conflictPairs: [string, string][] = [
    ['Active',          'Lazy'],
    ['Adventurous',     'Lazy'],
    ['Ambitious',       'Freegan'],
    ['Ambitious',       'Lazy'],
    ['Cheerful',        'Gloomy'],
    ['Cheerful',        'Hot-Headed'],
    ['Childish',        'Evil'],
    ['Childish',        'Hates Children'],
    ['Childish',        'Snob'],
    ['Clumsy',          'Maker'],
    ['Evil',            'Generous'],
    ['Evil',            'Good'],
    ['Family-Oriented', 'Hates Children'],
    ['Family-Oriented', 'Noncommittal'],
    ['Foodie',          'Freegan'],
    ['Foodie',          'Glutton'],
    ['Freegan',         'Materialistic'],
    ['Freegan',         'Snob'],
    ['Freegan',         'Squeamish'],
    ['Generous',        'Glutton'],
    ['Generous',        'Materialistic'],
    ['Generous',        'Mean'],
    ['Gloomy',          'Hot-Headed'],
    ['Gloomy',          'Party Animal'],
    ['Good',            'Kleptomaniac'],
    ['Good',            'Mean'],
    ['Goofball',        'Snob'],
    ['Glutton',         'Squeamish'],
    ['Horse Lover',     'Lazy'],
    ['Insider',         'Loner'],
    ['Lazy',            'Maker'],
    ['Lazy',            'Neat'],
    ['Lazy',            'Overachiever'],
    ['Lazy',            'Rancher'],
    ['Loner',           'Outgoing'],
    ['Loner',           'Party Animal'],
    ['Loves Outdoors',  'Squeamish'],
    ['Loyal',           'Noncommittal'],
    ['Mean',            'Proper'],
    ['Neat',            'Slob'],
    ['Outgoing',        'Paranoid'],
    ['Outgoing',        'Socially Awkward'],
    ['Party Animal',    'Socially Awkward'],
    ['Proper',          'Slob'],
    ['Romantic',        'Unflirty'],
    ['Slob',            'Squeamish'],
  ]

  for (const [nameA, nameB] of conflictPairs) {
    const a = await prisma.personalityTrait.findFirst({ where: { name: nameA } })
    const b = await prisma.personalityTrait.findFirst({ where: { name: nameB } })
    if (!a || !b) { console.warn(`Skipping conflict ${nameA} <-> ${nameB}: trait not found`); continue }
    const [traitAId, traitBId] = [a.id, b.id].sort()
    await prisma.personalityTraitConflict.upsert({
      where:  { traitAId_traitBId: { traitAId, traitBId } },
      create: { traitAId, traitBId },
      update: {},
    })
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
    { name: 'Joke Star',                 category: AspirationCategory.POPULARITY,  bonusTraitId: await bt('Socially Gifted'), minLifeStage: LifeStage.YOUNG_ADULT },
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
    { name: 'Gourmet Cooking', minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Guitar',         minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Handiness',      minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Logic',          minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Mischief',       minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Mixology',       minLifeStage: LifeStage.TEEN, maxLevel: 10 },
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
    { name: 'Singing',            minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('City Living') },
    { name: 'Flower Arranging',   minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Seasons') },
    { name: 'Skating',            minLifeStage: LifeStage.TEEN, maxLevel: 5,  packId: await pack('Seasons') },
    { name: 'Research & Debate',  minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Discover University') },
    { name: 'Fabrication',        minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Eco Lifestyle') },
    { name: 'Cross-Stitch',       minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Cottage Living') },
    { name: 'Horseback Riding',   minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Horse Ranch') },
    { name: 'Wellness',           minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Spa Day') },
    { name: 'Parenting',          minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Parenthood') },
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
    { name: 'Critic',          type: CareerType.STANDARD, branchAName: 'Arts Critic',         branchBName: 'Food Critic',          packId: await pack('City Living') },
    { name: 'Culinary',        type: CareerType.STANDARD, branchAName: 'Chef',                branchBName: 'Mixologist' },
    { name: 'Entertainer',     type: CareerType.STANDARD, branchAName: 'Musician',            branchBName: 'Comedian' },
    { name: 'Painter',         type: CareerType.STANDARD, branchAName: 'Master of the Real',  branchBName: 'Patron of the Arts' },
    { name: 'Politician',      type: CareerType.STANDARD, branchAName: 'Charity Organizer',   branchBName: 'Politician',           packId: await pack('City Living') },
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

  // ── Built-in TrackerTypes ─────────────────────────────────────────────────
  console.log('Seeding built-in tracker types...')

  const builtInTrackerTypes = [
    {
      name: 'Skill Maxed',
      description: 'A sim in the phase generation has maxed a specific skill.',
      valueKind: 'BOOLEAN' as const,
      computationSpec: {
        simFilter: { generationNumber: '$phase.generationNumber' },
        conditions: [{ source: 'skills', dataFilter: { skillId: '$config.skillId', maxed: true } }],
        aggregation: { op: 'any' },
        valueKind: 'BOOLEAN',
      },
      configSchema: { type: 'object', properties: { skillId: { type: 'string' } }, required: ['skillId'] },
      goalSchema: null as object | null,
    },
    {
      name: 'Skill Level',
      description: 'A sim in the phase generation has reached a target skill level.',
      valueKind: 'BOOLEAN' as const,
      computationSpec: {
        simFilter: { generationNumber: '$phase.generationNumber' },
        conditions: [{ source: 'skills', dataFilter: { skillId: '$config.skillId', minLevel: '$config.targetLevel' } }],
        aggregation: { op: 'any' },
        valueKind: 'BOOLEAN',
      },
      configSchema: {
        type: 'object',
        properties: { skillId: { type: 'string' }, targetLevel: { type: 'number' } },
        required: ['skillId', 'targetLevel'],
      },
      goalSchema: null as object | null,
    },
    {
      name: 'Aspiration Completed',
      description: 'A sim in the phase generation has completed a specific aspiration.',
      valueKind: 'BOOLEAN' as const,
      computationSpec: {
        simFilter: { generationNumber: '$phase.generationNumber' },
        conditions: [{ source: 'aspirations', dataFilter: { aspirationId: '$config.aspirationId', completed: true } }],
        aggregation: { op: 'any' },
        valueKind: 'BOOLEAN',
      },
      configSchema: { type: 'object', properties: { aspirationId: { type: 'string' } }, required: ['aspirationId'] },
      goalSchema: null as object | null,
    },
    {
      name: 'Career Completed',
      description: 'A sim in the phase generation has completed a specific career.',
      valueKind: 'BOOLEAN' as const,
      computationSpec: {
        simFilter: { generationNumber: '$phase.generationNumber' },
        conditions: [{ source: 'careers', dataFilter: { careerId: '$config.careerId', completed: true } }],
        aggregation: { op: 'any' },
        valueKind: 'BOOLEAN',
      },
      configSchema: { type: 'object', properties: { careerId: { type: 'string' } }, required: ['careerId'] },
      goalSchema: null as object | null,
    },
    {
      name: 'Sim Died By Cause',
      description: 'Any legacy sim died by a specific cause.',
      valueKind: 'BOOLEAN' as const,
      computationSpec: {
        simFilter: {},
        conditions: [{ source: 'sims', dataFilter: { causeOfDeath: '$config.causeOfDeath' } }],
        aggregation: { op: 'any' },
        valueKind: 'BOOLEAN',
      },
      configSchema: { type: 'object', properties: { causeOfDeath: { type: 'string' } }, required: ['causeOfDeath'] },
      goalSchema: null as object | null,
    },
    {
      name: 'Count Unique Traits',
      description: 'Count distinct personality traits across sims in the phase generation.',
      valueKind: 'NUMERICAL' as const,
      computationSpec: {
        simFilter: { generationNumber: '$phase.generationNumber' },
        conditions: [{ source: 'personalityTraits', dataFilter: {} }],
        aggregation: { op: 'countUnique', field: 'personalityTraitId' },
        valueKind: 'NUMERICAL',
      },
      configSchema: { type: 'object', properties: { category: { type: 'string' } } },
      goalSchema: { type: 'object', properties: { goalValue: { type: 'number' }, unit: { type: 'string' } }, required: ['goalValue'] } as object | null,
    },
    {
      name: 'Manual Goal',
      description: 'A custom goal the user marks complete manually.',
      valueKind: 'BOOLEAN' as const,
      computationSpec: null,
      configSchema: { type: 'object', properties: {} },
      goalSchema: null as object | null,
    },
    {
      name: 'Manual Numerical Goal',
      description: 'A custom numerical goal the user tracks manually toward a target value.',
      valueKind: 'NUMERICAL' as const,
      computationSpec: null,
      configSchema: { type: 'object', properties: {} },
      goalSchema: { type: 'object', properties: { goalValue: { type: 'number' }, unit: { type: 'string' } }, required: ['goalValue'] } as object | null,
    },
    {
      name: 'Manual Threshold Goal',
      description: 'A goal with multiple thresholds, each worth one point when crossed.',
      valueKind: 'THRESHOLD' as const,
      computationSpec: null,
      configSchema: { type: 'object', properties: {} },
      goalSchema: {
        type: 'object',
        oneOf: [
          { properties: { thresholds: { type: 'array', items: { type: 'number' } }, unit: { type: 'string' } }, required: ['thresholds'] },
          { properties: { start: { type: 'number' }, step: { type: 'number' }, count: { type: 'number' }, unit: { type: 'string' } }, required: ['start', 'step', 'count'] },
        ],
      } as object | null,
    },
  ]

  for (const tt of builtInTrackerTypes) {
    await prisma.trackerType.upsert({
      where: { name: tt.name },
      update: {
        description: tt.description,
        computationSpec: tt.computationSpec ?? undefined,
        configSchema: tt.configSchema,
        goalSchema: tt.goalSchema ?? undefined,
      },
      create: {
        name: tt.name,
        description: tt.description,
        valueKind: tt.valueKind,
        isBuiltIn: true,
        isPublic: true,
        computationSpec: tt.computationSpec ?? undefined,
        configSchema: tt.configSchema,
        goalSchema: tt.goalSchema ?? undefined,
      },
    })
  }

  // ── Not So Berry challenge template ───────────────────────────────────────
  console.log('Seeding Not So Berry challenge...')

  const existingNotSoBerry = await prisma.challenge.findFirst({
    where: { name: 'Not So Berry', ownerId: null },
  })

  if (existingNotSoBerry) {
    console.log('Not So Berry challenge already seeded, skipping.')
  } else {
    const ttId = async (name: string) =>
      (await prisma.trackerType.findUniqueOrThrow({ where: { name } })).id
    const skillMaxedTypeId = await ttId('Skill Maxed')
    const aspirationCompletedTypeId = await ttId('Aspiration Completed')
    const careerCompletedTypeId = await ttId('Career Completed')
    const manualGoalTypeId = await ttId('Manual Goal')
    const manualNumericalTypeId = await ttId('Manual Numerical Goal')

    const maxSkill = async (skillName: string, sortOrder: number) => ({
      trackerTypeId: skillMaxedTypeId,
      name: `Max the ${skillName} skill`,
      config: { skillId: (await prisma.skill.findUniqueOrThrow({ where: { name: skillName } })).id },
      sortOrder,
    })
    const completeAspiration = async (aspirationName: string, sortOrder: number) => ({
      trackerTypeId: aspirationCompletedTypeId,
      name: `Complete the ${aspirationName} aspiration`,
      config: { aspirationId: (await prisma.aspiration.findUniqueOrThrow({ where: { name: aspirationName } })).id },
      sortOrder,
    })
    const masterCareer = async (careerName: string, sortOrder: number) => ({
      trackerTypeId: careerCompletedTypeId,
      name: `Master the ${careerName} career`,
      config: { careerId: (await prisma.career.findUniqueOrThrow({ where: { name: careerName } })).id },
      sortOrder,
    })
    const manualGoal = (name: string, description: string, sortOrder: number) => ({
      trackerTypeId: manualGoalTypeId,
      name,
      description,
      config: {},
      sortOrder,
    })
    const manualCount = (name: string, description: string, goalValue: number, unit: string, sortOrder: number) => ({
      trackerTypeId: manualNumericalTypeId,
      name,
      description,
      config: {},
      goalConfig: { goalValue, unit },
      sortOrder,
    })

    await prisma.challenge.create({
      data: {
        name: 'Not So Berry',
        description:
          'A ten-generation legacy challenge by lilsimsie and alwaysimming. Each generation is themed around a color and comes with its own traits, career, aspiration, and skill goals. Play with a normal lifespan and keep money cheats to a minimum.',
        isPublic: true,
        phases: {
          create: [
            {
              generationNumber: 1,
              title: 'Generation One: Mint',
              description:
                'A mischievous scientist who really loves the color mint. Traits: Vegetarian, Materialistic, Jealous.',
              sortOrder: 0,
              trackers: {
                create: [
                  await masterCareer('Scientist', 0),
                  await completeAspiration('Chief of Mischief', 1),
                  await maxSkill('Mischief', 2),
                  await maxSkill('Logic', 3),
                  manualGoal(
                    'Complete the Elements collection',
                    'Collect all elements. Collections are not tracked automatically — mark this complete yourself.',
                    4,
                  ),
                ],
              },
            },
            {
              generationNumber: 2,
              title: 'Generation Two: Rose',
              description:
                'Had everything as a child but always longed for more; career-focused and afraid to commit. Traits: Hot-Headed, Snob, Romantic.',
              sortOrder: 1,
              trackers: {
                create: [
                  await masterCareer('Politician', 0),
                  await completeAspiration('Serial Romantic', 1),
                  await maxSkill('Charisma', 2),
                  manualGoal('Have only one child', 'The heir must be an only child.', 3),
                ],
              },
            },
            {
              generationNumber: 3,
              title: 'Generation Three: Yellow',
              description:
                'A reclusive genius reaching for the stars. Traits: Clumsy, Ambitious, Loner.',
              sortOrder: 2,
              trackers: {
                create: [
                  await masterCareer('Astronaut', 0),
                  await completeAspiration('Nerd Brain', 1),
                  await maxSkill('Rocket Science', 2),
                  await maxSkill('Handiness', 3),
                  manualGoal('Visit Sixam', 'Travel to the alien world via the rocket ship or wormhole generator.', 4),
                ],
              },
            },
            {
              generationNumber: 4,
              title: 'Generation Four: Grey',
              description:
                'An athlete with a song in their heart and a mess in their wake. Traits: Active, Slob, Music Lover.',
              sortOrder: 3,
              trackers: {
                create: [
                  await masterCareer('Athlete', 0),
                  await completeAspiration('Bodybuilder', 1),
                  await maxSkill('Fitness', 2),
                  await maxSkill('Singing', 3),
                  await maxSkill('Parenting', 4),
                  manualGoal(
                    'Marry a sim with the Neat trait',
                    'After three failed relationships, settle down with a Neat spouse.',
                    5,
                  ),
                ],
              },
            },
            {
              generationNumber: 5,
              title: 'Generation Five: Plum',
              description:
                'A jack of all trades who can never settle on one thing — or one place. Traits: Noncommittal, Dance Machine, Genius.',
              sortOrder: 4,
              trackers: {
                create: [
                  await completeAspiration('Renaissance Sim', 0),
                  await maxSkill('Dancing', 1),
                  manualCount(
                    'Reach level 8 in six different skills',
                    'Any six skills count toward this goal.',
                    6,
                    'skills',
                    2,
                  ),
                  manualCount(
                    'Work in three different careers',
                    'Fast Food, Doctor, and Entertainer.',
                    3,
                    'careers',
                    3,
                  ),
                  manualCount('Live in three different worlds', 'Move the household across three worlds.', 3, 'worlds', 4),
                  manualGoal('Marry, divorce, and remarry the same sim', 'True love finds a way — eventually.', 5),
                ],
              },
            },
            {
              generationNumber: 6,
              title: 'Generation Six: Orange',
              description:
                'A villainous baker rising through the criminal underworld. Traits: Glutton, Evil, Self-Assured.',
              sortOrder: 5,
              trackers: {
                create: [
                  await masterCareer('Criminal', 0),
                  await completeAspiration('Public Enemy', 1),
                  await maxSkill('Baking', 2),
                  await maxSkill('Charisma', 3),
                  manualGoal('Have twins and no other children', 'The heir must be one of the twins.', 4),
                ],
              },
            },
            {
              generationNumber: 7,
              title: 'Generation Seven: Pink',
              description:
                'An orderly creative who leaves the corporate world to write. Traits: Neat, Creative, Unflirty.',
              sortOrder: 6,
              trackers: {
                create: [
                  await masterCareer('Business', 0),
                  await completeAspiration('Bestselling Author', 1),
                  await maxSkill('Writing', 2),
                  await maxSkill('Wellness', 3),
                  manualGoal(
                    'Complete the Postcard collection',
                    'Collections are not tracked automatically — mark this complete yourself.',
                    4,
                  ),
                ],
              },
            },
            {
              generationNumber: 8,
              title: 'Generation Eight: Peach',
              description:
                'A laid-back detective with a taste for fine food and bad jokes. Traits: Foodie, Lazy, Goofball.',
              sortOrder: 7,
              trackers: {
                create: [
                  await masterCareer('Detective', 0),
                  await completeAspiration('Joke Star', 1),
                  await maxSkill('Gourmet Cooking', 2),
                  await maxSkill('Comedy', 3),
                  manualGoal('Marry a co-worker', 'Find love on the force.', 4),
                ],
              },
            },
            {
              generationNumber: 9,
              title: 'Generation Nine: Green',
              description:
                'A socially awkward tech whiz who never turns down a party invitation. Traits: Squeamish, Cheerful, Geek.',
              sortOrder: 8,
              trackers: {
                create: [
                  await masterCareer('Tech Guru', 0),
                  await completeAspiration('Computer Whiz', 1),
                  await maxSkill('Programming', 2),
                  await maxSkill('Video Gaming', 3),
                  await maxSkill('Mixology', 4),
                  manualCount('Make five good friends', 'Reach good friend status with five sims.', 5, 'friends', 5),
                  manualCount('Make five enemies', 'Reach enemy status with five sims.', 5, 'enemies', 6),
                ],
              },
            },
            {
              generationNumber: 10,
              title: 'Generation Ten: Blue',
              description:
                'A devoted family sim and harsh critic closing out the legacy. Traits: Gloomy, Perfectionist, Family-Oriented.',
              sortOrder: 9,
              trackers: {
                create: [
                  await masterCareer('Critic', 0),
                  await completeAspiration('Super Parent', 1),
                  await maxSkill('Photography', 2),
                  await maxSkill('Cooking', 3),
                  await maxSkill('Parenting', 4),
                  manualGoal('Marry your high school sweetheart', 'A teen romance that goes the distance.', 5),
                ],
              },
            },
          ],
        },
      },
    })
  }

  // ── Worlds & canonical lots ───────────────────────────────────────────────
  console.log('Seeding worlds and lots...')

  // Pack linkage by pack code; null = base game / free update.
  const worldSeed: Array<{ name: string; packCode: string | null; lots: string[] }> = [
    { name: 'Willow Creek',      packCode: null,   lots: ['165 Sim Lane', '1 Goth Hill', '21 Culpepper House', '3 Forrester Lane', '15 Crawdad Quarter'] },
    { name: 'Oasis Springs',     packCode: null,   lots: ['4 Affluista Way', '21 Crick Cabana', '55 Oak Arbor', '9 Acolyte Lane', '7 Pendula View'] },
    { name: 'Newcrest',          packCode: null,   lots: ['1 Llama Lagoon', '2 Hightower Hollow', '3 Sandtrap Flat'] },
    { name: 'Magnolia Promenade',packCode: 'EP01', lots: [] },
    { name: 'Windenburg',        packCode: 'EP02', lots: ['44 Russett Way', '12 Von Haunt Estate', '8 Crumbling Isle'] },
    { name: 'San Myshuno',       packCode: 'EP03', lots: ['1018 Culpepper Apt', '701 Stella Terrace', '7 Spice Market'] },
    { name: 'Brindleton Bay',    packCode: 'EP04', lots: [] },
    { name: 'Del Sol Valley',    packCode: 'EP06', lots: [] },
    { name: 'Sulani',            packCode: 'EP07', lots: [] },
    { name: 'Britechester',      packCode: 'EP08', lots: [] },
    { name: 'Evergreen Harbor',  packCode: 'EP09', lots: [] },
    { name: 'Mt. Komorebi',      packCode: 'EP10', lots: [] },
    { name: 'Henford-on-Bagley', packCode: 'EP11', lots: [] },
    { name: 'Copperdale',        packCode: 'EP12', lots: [] },
    { name: 'San Sequoia',       packCode: 'EP13', lots: [] },
    { name: 'Chestnut Ridge',    packCode: 'EP14', lots: [] },
    { name: 'Tomarang',          packCode: 'EP15', lots: [] },
    { name: 'Ciudad Enamorada',  packCode: 'EP16', lots: [] },
    { name: 'Ravenwood',         packCode: 'EP17', lots: [] },
    { name: 'Nordhaven',         packCode: 'EP18', lots: [] },
    { name: 'Innisgreen',        packCode: 'EP19', lots: [] },
    { name: 'Forgotten Hollow',  packCode: 'GP04', lots: [] },
    { name: 'StrangerVille',     packCode: 'GP07', lots: [] },
    { name: 'Glimmerbrook',      packCode: 'GP08', lots: [] },
    { name: 'Moonwood Mill',     packCode: 'GP12', lots: [] },
    { name: 'Tartosa',           packCode: 'GP11', lots: [] },
  ]

  for (const w of worldSeed) {
    const packId = w.packCode ? await packByCode(w.packCode) : null
    const world = await prisma.world.upsert({
      where: { name: w.name },
      update: { packId },
      create: { name: w.name, packId },
    })
    for (const lotName of w.lots) {
      await prisma.lot.upsert({
        where: { worldId_name: { worldId: world.id, name: lotName } },
        update: {},
        create: { worldId: world.id, name: lotName },
      })
    }
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
