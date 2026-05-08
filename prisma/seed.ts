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
    description?: string
    category: TraitCategory
    minLifeStage?: LifeStage
    maxLifeStage?: LifeStage
    packId?: string
  }> = [
    // ── Base game — Child+ ──────────────────────────────────────────────────
    // Emotional
    { name: 'Cheerful',     category: TraitCategory.EMOTIONAL, description: 'These Sims tend to be Happier than other Sims.' },
    { name: 'Creative',     category: TraitCategory.HOBBY,     description: 'These Sims tend to be Inspired, can Share Creative Ideas with other Sims, and may become upset if they\'re not creative for a period of time.' },
    { name: 'Erratic',      category: TraitCategory.EMOTIONAL, description: 'These Sims can Talk to themselves and have unpredictable Emotions.' },
    { name: 'Genius',       category: TraitCategory.LIFESTYLE, description: 'These Sims tend to be Focused, can Share Ideas with other Sims, and may become upset if they haven\'t improved their Mental Skills for some time.' },
    { name: 'Gloomy',       category: TraitCategory.EMOTIONAL, description: 'These Sims tend to be Sad, can Share Melancholy Thoughts to other Sims, and while sad, gain a boost to their Creative Skill.' },
    { name: 'Goofball',     category: TraitCategory.EMOTIONAL, description: 'These Sims tend to be Playful.' },
    { name: 'Hot-Headed',   category: TraitCategory.EMOTIONAL, description: 'These Sims tend to be Angry, can Rile up other Sims, and become Angry when targeted with Mischief.' },
    { name: 'Self-Assured', category: TraitCategory.EMOTIONAL, description: 'These Sims tend to be Confident.' },
    // Hobby
    { name: 'Art Lover',      category: TraitCategory.HOBBY, description: 'These Sims gain powerful Moodlets from Viewing works of art and can Admire Art and Discuss Art in unique ways.' },
    { name: 'Bookworm',       category: TraitCategory.HOBBY, description: 'These Sims gain powerful Moodlets from reading Books and can Analyze Books and Discuss Books in unique ways.' },
    { name: 'Geek',           category: TraitCategory.HOBBY, description: 'These Sims become Happy when Reading Sci-Fi or Playing Video Games, may become Tense if they haven\'t played much, are better at finding Collectibles, and can Discuss Geek Things with other Geek Sims.' },
    { name: 'Loves Outdoors', category: TraitCategory.HOBBY, description: 'These Sims can Enthuse about Nature to other Sims and become Happy when Outdoors.' },
    { name: 'Music Lover',    category: TraitCategory.HOBBY, description: 'These Sims gain powerful Moodlets and boost their Fun Need when Listening to Music and become Happy when playing instruments.' },
    // Lifestyle
    { name: 'Active',        category: TraitCategory.LIFESTYLE, description: 'These Sims tend to be Energized, can Pump Up other Sims, and may become upset if they don\'t exercise for a period of time.' },
    { name: 'Glutton',       category: TraitCategory.LIFESTYLE, description: 'These Sims have a greater negative reaction to Hunger, always enjoy eating, no matter the quality of the food, and will eat Spoiled Food.' },
    { name: 'Kleptomaniac',  category: TraitCategory.LIFESTYLE, description: 'These Sims don\'t mind "borrowing" things from others with a simple swipe, but will get Tense when they have not swiped anything in a while.' },
    { name: 'Lazy',          category: TraitCategory.LIFESTYLE, description: 'These Sims gain powerful Moodlets from Watching TV or Napping as well as from Comfortable furniture, become Fatigued more quickly from exercise, and grow Tense when performing household chores.' },
    { name: 'Neat',          category: TraitCategory.LIFESTYLE, description: 'These Sims become Happy and have Fun when performing household chores, can have a Cleaning Frenzy, and become really Uncomfortable in dirty surroundings.' },
    { name: 'Perfectionist', category: TraitCategory.LIFESTYLE, description: 'These Sims take longer to craft items but tend to make them higher quality, gain powerful Moodlets after crafting a high quality item, and gain negative Moodlets after crafting a low quality item.' },
    { name: 'Slob',          category: TraitCategory.LIFESTYLE, description: 'These Sims are not affected by dirty surroundings, make household items dirtier faster, and can Rummage for Food in garbage.' },
    // Social
    { name: 'Evil',  category: TraitCategory.EMOTIONAL, description: 'These Sims become Happy around Sims with negative Moodlets, can Laugh Maniacally and Discuss Evil Plans, and become Angry when interacting with Good Sims.' },
    { name: 'Good',  category: TraitCategory.EMOTIONAL, description: 'These Sims become Happy around Sims with positive Moodlets, can Donate to Charity, become Sad with interacting with Evil Sims, and can Discuss World Peace.' },
    { name: 'Loner', category: TraitCategory.SOCIAL,    description: 'These Sims become Happy when alone, do not receive negative Moodlets when their Social Need is low, become Tense around strangers, and become Embarrassed more often by social rejection.' },
    { name: 'Mean',  category: TraitCategory.SOCIAL,    description: 'These Sims become Happy when being Mean or Mischievous to other Sims and become Confident after winning a fight.' },
    { name: 'Outgoing', category: TraitCategory.SOCIAL, description: 'These Sims gain powerful Moodlets from Friendly socialization, have their Social need decay quickly, and gain more negative Moodlets when their Social need is low.' },

    // ── Base game — Teen+ ───────────────────────────────────────────────────
    { name: 'Childish',       category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'These Sims gain powerful Moodlets from watching the Kids Network, become Playful when playing with Children, and become Happy when playing with Children\'s toys.' },
    { name: 'Clumsy',         category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'These Sims tend to fail more often at physical activities and tend to laugh at failure instead of becoming upset.' },
    { name: 'Hates Children', category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'These Sims become Angry around Children, become Tense after Try for a Baby, and can be Mean to Children.' },
    { name: 'Loyal',          category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'Loyal sims value their relationships and fully commit to them. whether they are friendship, romance or even work! They avoid lying and cheating because their loved ones\' trust is very important to them.' },
    { name: 'Materialistic',  category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'These Sims can Admire and Brag about Possessions and become Sad when they haven\'t purchased a new item for a period of time.' },
    { name: 'Snob',           category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'These Sims can Critique Work on low quality items, are bored by "low brow" television, and gain Confidence around other Snob Sims.' },
    { name: 'Bro',            category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'These Sims can Bro Hug other Bros, gain Confidence around other Bros, and become Energized from Watching Sports.' },
    { name: 'Jealous',        category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'These Sims get Jealous more easily than other Sims. They gain a boost of Confidence from being around their significant other, but get Tense if they haven\'t seen them recently.' },

    // ── Base game — Young Adult+ ────────────────────────────────────────────
    { name: 'Ambitious',     category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.YOUNG_ADULT, description: 'These Sims gain powerful Moodlets from career success, gain negative Moodlets from career failure, and may become Tense if not promoted.' },
    { name: 'Family-Oriented', category: TraitCategory.SOCIAL,  minLifeStage: LifeStage.YOUNG_ADULT, description: 'These Sims become Happy around family members, become Sad if they don\'t interact with family for a period of time, and can Boast about Family.' },
    { name: 'Foodie',        category: TraitCategory.HOBBY,     minLifeStage: LifeStage.YOUNG_ADULT, description: 'These Sims become Happy and have Fun when eating good food, become Uncomfortable when eating bad food, and can Watch Cooking Shows for ideas.' },
    { name: 'Noncommittal',  category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.YOUNG_ADULT, description: 'These Sims become Tense after a while in the same job or relationship, become Happy when they Quit a Job or Break Off a relationship, take longer to Propose, and can Discuss their Fear of Commitment.' },
    { name: 'Romantic',      category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.YOUNG_ADULT, description: 'These Sims tend to be Flirty and may become Sad if they don\'t have any Romantic social interactions for a period of time.' },

    // ── Cats & Dogs ─────────────────────────────────────────────────────────
    { name: 'Cat Lover', category: TraitCategory.SOCIAL, description: 'These Sims tend to make cats their companions, preferring the company of cats to other Sims.',                                     packId: await pack('Cats & Dogs') },
    { name: 'Dog Lover', category: TraitCategory.SOCIAL, description: 'These Sims love to be near dogs. They will gain relationships faster with dogs and socialize with dogs more than the average Sim.', packId: await pack('Cats & Dogs') },

    // ── City Living ──────────────────────────────────────────────────────────
    { name: 'Unflirty', category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'These Sims get Tense around Flirty Sims and seldom get Flirty themselves. It\'s difficult for them to be Romantic in public.', packId: await pack('City Living') },

    // ── Cottage Living ───────────────────────────────────────────────────────
    { name: 'Animal Enthusiast',  category: TraitCategory.SOCIAL,    description: 'These Sims are obsessed with animals, and will seek their company often. They will have an easier time caring for animals and getting closer to them.', packId: await pack('Cottage Living') },
    { name: 'Lactose Intolerant', category: TraitCategory.LIFESTYLE, description: 'These Sims will become sick if they eat dairy, but will feel great if they have avoided it for a while.',                                            packId: await pack('Cottage Living') },

    // ── Eco Lifestyle ────────────────────────────────────────────────────────
    { name: 'Green Fiend',      category: TraitCategory.LIFESTYLE, description: 'These Sims are happiest when living on a green street and will continuously work towards making their environment more eco-friendly.',                                                                                         packId: await pack('Eco Lifestyle') },
    { name: 'Recycle Disciple', category: TraitCategory.HOBBY,     description: 'These Sims are rabid recyclers that benefit from recycling and rummaging for bits and pieces, but should they go too long without indulging in their hobby...',                                                               packId: await pack('Eco Lifestyle') },
    { name: 'Freegan',          category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'These Sims reject consumerism and prefer to reduce wasteful spending by any means. They enjoy finding re-used or thrown away goods and foods. In fact, they have the best luck at finding the highest-quality treasures in Dumpsters! They may become tense or uncomfortable if they spend too much time earning or spending Simoleons.', packId: await pack('Eco Lifestyle') },
    { name: 'Maker',            category: TraitCategory.HOBBY,     minLifeStage: LifeStage.TEEN, description: 'These Sims become happy when making things. They become sad when it\'s been too long since completing a project on a Fabricator, Candlemaking Station, Juice Fizzer, or Woodworking Table. They do not receive negative effects from crafting or repair failures.',                                packId: await pack('Eco Lifestyle') },

    // ── For Rent ─────────────────────────────────────────────────────────────
    { name: 'Generous', category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'Caring, empathetic, and patient. These Sims are happiest when offering their time and money to help others. Everyone loves Generous Sims, but they can be a little too brazen with their donations.', packId: await pack('For Rent') },
    { name: 'Nosy',     category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'Sims who thrive on gossip, snooping, and spying. They have incredibly poor boundaries and don\'t quite understand what personal space is, but they will discover secrets by any means necessary.',    packId: await pack('For Rent') },

    // ── Get Famous ───────────────────────────────────────────────────────────
    { name: 'Self-Absorbed', category: TraitCategory.SOCIAL, minLifeStage: LifeStage.TEEN, description: 'These Sims are all about themselves! They can Fish for Compliments, are more excited when receiving a present, and may become tense when they haven\'t gotten enough attention. The celebrity spotlight is something they generally relish. After all, everyone else should love them as much as they do themselves, right?', packId: await pack('Get Famous') },

    // ── Get Together ─────────────────────────────────────────────────────────
    { name: 'Dance Machine', category: TraitCategory.HOBBY,   minLifeStage: LifeStage.TEEN, description: 'These Sims can\'t wait to get down, boogie, and party all night! When at venues like Bars, Nightclubs, and Lounges, these Sims can get a burst of energy with the Party Time interaction.', packId: await pack('Get Together') },
    { name: 'Insider',       category: TraitCategory.SOCIAL,  description: 'These Sims love being in Clubs, and tend to be happiest when surrounded by their friends.',                                                                                                                                  packId: await pack('Get Together') },

    // ── High School Years ────────────────────────────────────────────────────
    { name: 'Overachiever',   category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'These Sims tend to raise their skills faster and are happy when they finish work tasks, but are a little harder to get along with as friends.',                                                                                                                  packId: await pack('High School Years') },
    { name: 'Party Animal',   category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TEEN, description: 'These Sims tend to enjoy parties and letting every other Sim know by hyping up a crowd and performing party tricks.',                                                                                                                                          packId: await pack('High School Years') },
    { name: 'Socially Awkward', category: TraitCategory.SOCIAL,  minLifeStage: LifeStage.TEEN, description: 'These Sims tend to struggle in social situations and build charisma more slowly, but gain powerful Moodlets and Sentiments when they are able to overcome their awkwardness and accompanying nervousness to form close relationships.',                         packId: await pack('High School Years') },

    // ── Horse Ranch ──────────────────────────────────────────────────────────
    { name: 'Horse Lover', category: TraitCategory.SOCIAL,    packId: await pack('Horse Ranch') },
    { name: 'Rancher',     category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.YOUNG_ADULT, packId: await pack('Horse Ranch') },

    // ── Island Living ────────────────────────────────────────────────────────
    { name: 'Child of the Islands', category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'These Sims experience a spiritual connection to islands of Sulani. Honor the islands by partaking in their culture, summon powerful elementals and reap the rewards of their blessings—or the consequences of their disfavor.', packId: await pack('Island Living') },
    { name: 'Child of the Ocean',   category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TEEN, description: 'Answer the call of the ocean! Sims with this trait will prefer water related activities and feel closer to denizens of the sea.',                                                                                                packId: await pack('Island Living') },

    // ── Outdoor Retreat ──────────────────────────────────────────────────────
    { name: 'Squeamish', category: TraitCategory.EMOTIONAL, description: 'Squeamish Sims are nauseated by the sight of creepy crawlies, vomiting, violence and death. These Sims become Uncomfortable near anything dirty.', packId: await pack('Outdoor Retreat') },

    // ── Snowy Escape ─────────────────────────────────────────────────────────
    { name: 'Adventurous', category: TraitCategory.LIFESTYLE, description: 'These Sims seek out new and unique experiences.',                                                                                                                                                                                     packId: await pack('Snowy Escape') },
    { name: 'Proper',      category: TraitCategory.SOCIAL,    description: 'These Sims tend to disapprove of other Sims\' improper behavior such as Mean or Mischievous socials, but find themselves happier in Formal Outfits and have a much easier time with Friendly and Romantic socials.',                   packId: await pack('Snowy Escape') },

    // ── Spa Day ──────────────────────────────────────────────────────────────
    { name: 'High Maintenance', category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'These Sims require extra work to keep in good condition. Their problems sometimes appear trivial, and may even appear out of the blue. These struggles can be remedied through mindful habits, which puts them in a state of catharsis.', packId: await pack('Spa Day') },

    // ── StrangerVille ────────────────────────────────────────────────────────
    { name: 'Paranoid', category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TEEN, description: 'Paranoid Sims feel that danger is around every corner, and that people are always talking about them. Paranoid Sims feel a sense of security while hanging out in basements.', packId: await pack('StrangerVille') },

    // ── Vegetarian (City Living) ─────────────────────────────────────────────
    { name: 'Vegetarian', category: TraitCategory.LIFESTYLE, description: 'These Sims will actively avoid eating foods that contain meat products and can become sick if they eat such foods.', packId: await pack('City Living') },

    // ── Infant traits — Growing Together ────────────────────────────────────
    { name: 'Calm (Infant)',     category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, description: 'These Sims like to watch the world, are less likely to cry or become angry, and don\'t grow tired of activities as easily as other infants; however, they are less likely to explore the world on their own.',                                                 packId: await pack('Growing Together') },
    { name: 'Cautious (Infant)', category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, description: 'These Sims appreciate the familiar but are slow to warm up to new experiences, locations, and Sims.',                                                                                                                                                       packId: await pack('Growing Together') },
    { name: 'Clingy (Infant)',   category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT,                                                                                                                                                                                                                                                                          packId: await pack('Growing Together') },
    { name: 'Intense (Infant)',  category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, description: 'These Sims have big emotions and are easily entertained, but they are also more difficult to calm when in a bad mood.',                                                                                                                                      packId: await pack('Growing Together') },
    { name: 'Sensitive',         category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, description: 'These Sims are prone to diaper rash, are often picky with food, and can more easily become overstimulated by too much play and social interaction; however, they also rest more peacefully through the night when soothed.',                                 packId: await pack('Growing Together') },
    { name: 'Sunny',             category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, description: 'These Sims are bursting with smiles and giggles and enjoy engaging with other Sims, but they do require more social attention.',                                                                                                                            packId: await pack('Growing Together') },
    { name: 'Wiggly',            category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, description: 'These Sims are always on the go and want to play and move about; however they often struggle to fall asleep or pay attention for extended periods of time.',                                                                                                 packId: await pack('Growing Together') },

    // ── Toddler traits — base game ───────────────────────────────────────────
    { name: 'Angelic',          category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'Idyllic, easygoing Toddlers. They are never defiant and they don\'t throw a tantrum. They can easily talk to strangers.' },
    { name: 'Charmer',          category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'These Toddlers love to socialize. They earn Communication skill faster, and don\'t suffer Stranger Danger from strangers. They can Share the Love with other Sims.' },
    { name: 'Clingy (Toddler)', category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'These shy Toddlers avoid Sims outside the household and get sad if left behind. They gain extra skill when taught. And they recover faster from bad moods when Comforted.' },
    { name: 'Fussy',            category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'Tiny trouble-makers who love to Cry, cause trouble, and Throw Fits. But being noticed makes them Happy and helps them overcome negative Moodlets.' },
    { name: 'Independent',      category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'These Toddlers love their freedom, and don\'t like to take orders from caregivers. They gain extra skill when they are left alone, and need less Attention than other Toddlers.' },
    { name: 'Inquisitive',      category: TraitCategory.HOBBY,     minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'Curious explorers. These Toddlers gain Thinking skill slightly faster. They are happiest when learning something, and sad if they haven\'t learned anything lately.' },
    { name: 'Silly',            category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'Goofy and curious. These Toddlers love to tell jokes and get Playful. They earn Imagination skill slightly faster.' },
    { name: 'Wild',             category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, description: 'Spirited and full of Energy. These Toddlers love to explore and get Energized. They earn Movement skill slightly faster. They get sad if they haven\'t been outside in a while.' },
  ]

  for (const t of personalityTraitSeed) {
    await prisma.personalityTrait.upsert({
      where:  { name: t.name },
      update: { description: t.description ?? null },
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
    const a = await prisma.personalityTrait.findUnique({ where: { name: nameA } })
    const b = await prisma.personalityTrait.findUnique({ where: { name: nameB } })
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
