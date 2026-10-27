#!/usr/bin/env python3
# =========================================
# D&D EN ESPAÑOL: LOS NOMBRES DE LAS COSAS
# =========================================
# Lo que usa el importador de D&D Beyond (1-publicar/dndbeyond.py) para
# pasar al español lo que llega en inglés: características, habilidades,
# clases, razas, idiomas, competencias, tipos de daño, objetos de lo más
# corriente y conjuros. Los nombres son los de la traducción oficial de
# la 5.ª edición (la de Edge / Wizards).
#
# LO QUE NO ESTÉ AQUÍ SE QUEDA EN INGLÉS, y el editor dice cuáles han sido
# para que los cambies a mano. Si quieres que la próxima vez salga ya en
# español, apúntalo en herramientas/dnd-es-propias.json (lo lee esto y
# manda sobre lo de aquí):
#
#     {
#         "Raulothim's Psychic Lance": "Lanza psíquica de Raulothim",
#         "Spellweaver": "Tejedor de conjuros"
#     }
#
# Se busca sin mayúsculas ni signos raros (el apóstrofo curvo y el recto
# valen igual).

import json
import re
from pathlib import Path

PROPIAS = Path(__file__).resolve().parent / "dnd-es-propias.json"

# Las seis características, por su número en D&D Beyond (1 a 6).
CARACTERISTICAS = {1: ("fue", "Fuerza"), 2: ("des", "Destreza"), 3: ("con", "Constitución"),
                   4: ("int", "Inteligencia"), 5: ("sab", "Sabiduría"), 6: ("car", "Carisma")}
CARACTERISTICA_DE_NOMBRE = {"strength": 1, "dexterity": 2, "constitution": 3, "intelligence": 4, "wisdom": 5,
                            "charisma": 6}

# Las habilidades: el «subType» de D&D Beyond -> el nombre de la ficha del
# sitio (el de generar-personajes.py).
HABILIDADES = {
    "acrobatics": "Acrobacias", "arcana": "Arcanos", "athletics": "Atletismo", "deception": "Engaño",
    "history": "Historia", "performance": "Interpretación", "intimidation": "Intimidación",
    "investigation": "Investigación", "sleight-of-hand": "Juego de manos", "medicine": "Medicina",
    "nature": "Naturaleza", "perception": "Percepción", "insight": "Perspicacia", "persuasion": "Persuasión",
    "religion": "Religión", "stealth": "Sigilo", "survival": "Supervivencia", "animal-handling": "Trato con animales",
}

TERMINOS = {
    # Clases
    "Artificer": "Artífice", "Barbarian": "Bárbaro", "Bard": "Bardo", "Cleric": "Clérigo", "Druid": "Druida",
    "Fighter": "Guerrero", "Monk": "Monje", "Paladin": "Paladín", "Ranger": "Explorador", "Rogue": "Pícaro",
    "Sorcerer": "Hechicero", "Warlock": "Brujo", "Wizard": "Mago", "Blood Hunter": "Cazador de sangre",
    # Subclases (las más vistas)
    "Path of the Berserker": "Senda del berserker", "Path of the Totem Warrior": "Senda del guerrero totémico",
    "College of Lore": "Colegio del Conocimiento", "College of Valor": "Colegio del Valor",
    "Life Domain": "Dominio de la Vida", "Light Domain": "Dominio de la Luz", "Knowledge Domain": "Dominio del Conocimiento",
    "Nature Domain": "Dominio de la Naturaleza", "Tempest Domain": "Dominio de la Tempestad",
    "Trickery Domain": "Dominio del Engaño", "War Domain": "Dominio de la Guerra",
    "Circle of the Land": "Círculo de la Tierra", "Circle of the Moon": "Círculo de la Luna",
    "Champion": "Campeón", "Battle Master": "Maestro de batalla", "Eldritch Knight": "Caballero arcano",
    "Way of the Open Hand": "Camino de la Mano Abierta", "Way of Shadow": "Camino de la Sombra",
    "Way of the Four Elements": "Camino de los Cuatro Elementos",
    "Oath of Devotion": "Juramento de Devoción", "Oath of the Ancients": "Juramento de los Ancestros",
    "Oath of Vengeance": "Juramento de Venganza", "Hunter": "Cazador", "Beast Master": "Señor de las bestias",
    "Thief": "Ladrón", "Assassin": "Asesino", "Arcane Trickster": "Embaucador arcano",
    "Draconic Bloodline": "Linaje dracónico", "Wild Magic": "Magia salvaje", "The Archfey": "El Señor Feérico",
    "The Fiend": "El Infernal", "The Great Old One": "El Primigenio", "School of Abjuration": "Escuela de Abjuración",
    "School of Conjuration": "Escuela de Conjuración", "School of Divination": "Escuela de Adivinación",
    "School of Enchantment": "Escuela de Encantamiento", "School of Evocation": "Escuela de Evocación",
    "School of Illusion": "Escuela de Ilusionismo", "School of Necromancy": "Escuela de Nigromancia",
    "School of Transmutation": "Escuela de Transmutación",
    # Razas
    "Human": "Humano", "Variant Human": "Humano (variante)", "Elf": "Elfo", "High Elf": "Alto elfo",
    "Wood Elf": "Elfo de los bosques", "Dark Elf (Drow)": "Elfo oscuro (drow)", "Drow": "Drow",
    "Half-Elf": "Semielfo", "Half-Orc": "Semiorco", "Dwarf": "Enano", "Hill Dwarf": "Enano de las colinas",
    "Mountain Dwarf": "Enano de las montañas", "Halfling": "Mediano", "Lightfoot Halfling": "Mediano piesligeros",
    "Stout Halfling": "Mediano fornido", "Gnome": "Gnomo", "Forest Gnome": "Gnomo de los bosques",
    "Rock Gnome": "Gnomo de las rocas", "Dragonborn": "Dracónido", "Tiefling": "Tiflin", "Aasimar": "Aasimar",
    "Goliath": "Goliat", "Tabaxi": "Tabaxi", "Firbolg": "Firbolg", "Kenku": "Kenku", "Tortle": "Tortle",
    "Genasi": "Genasi", "Orc": "Orco", "Goblin": "Goblin", "Kobold": "Kóbold", "Lizardfolk": "Hombre lagarto",
    "Triton": "Tritón", "Warforged": "Forjado", "Changeling": "Cambiante", "Harengon": "Harengon",
    # Idiomas
    "Common": "Común", "Elvish": "Élfico", "Dwarvish": "Enano", "Giant": "Gigante", "Gnomish": "Gnomo",
    "Abyssal": "Abisal", "Celestial": "Celestial",
    "Draconic": "Dracónico", "Deep Speech": "Habla profunda", "Infernal": "Infernal", "Primordial": "Primordial",
    "Sylvan": "Silvano", "Undercommon": "Infracomún", "Thieves' Cant": "Jerga de ladrones", "Druidic": "Druídico",
    # Competencias
    "Light Armor": "Armadura ligera", "Medium Armor": "Armadura intermedia", "Heavy Armor": "Armadura pesada",
    "Shields": "Escudos", "Simple Weapons": "Armas sencillas", "Martial Weapons": "Armas marciales",
    "Dagger": "Daga", "Dart": "Dardo", "Sling": "Honda", "Quarterstaff": "Bastón", "Crossbow, Light": "Ballesta ligera",
    "Crossbow, Hand": "Ballesta de mano", "Crossbow, Heavy": "Ballesta pesada", "Longsword": "Espada larga",
    "Shortsword": "Espada corta", "Rapier": "Estoque", "Scimitar": "Cimitarra", "Shortbow": "Arco corto",
    "Longbow": "Arco largo", "Handaxe": "Hacha de mano", "Battleaxe": "Hacha de batalla", "Greataxe": "Gran hacha",
    "Greatsword": "Espadón", "Warhammer": "Martillo de guerra", "Light Hammer": "Martillo ligero", "Mace": "Maza",
    "Javelin": "Jabalina", "Spear": "Lanza", "Club": "Clava", "Greatclub": "Gran clava", "Sickle": "Hoz",
    "Flail": "Mangual", "Glaive": "Guja", "Halberd": "Alabarda", "Lance": "Lanza de caballería", "Maul": "Mazo",
    "Morningstar": "Lucero del alba", "Pike": "Pica", "Trident": "Tridente", "War Pick": "Pico de guerra",
    "Whip": "Látigo", "Blowgun": "Cerbatana", "Net": "Red",
    "Thieves' Tools": "Herramientas de ladrón", "Herbalism Kit": "Útiles de herborista",
    "Disguise Kit": "Útiles de disfraz", "Forgery Kit": "Útiles de falsificación", "Poisoner's Kit": "Útiles de envenenador",
    "Navigator's Tools": "Herramientas de navegante", "Smith's Tools": "Herramientas de herrero",
    "Dragonchess Set": "Ajedrez de dragones", "Dice Set": "Juego de dados", "Playing Card Set": "Baraja de cartas",
    "Vehicles (Land)": "Vehículos (terrestres)", "Vehicles (Water)": "Vehículos (acuáticos)",
    # Tipos de daño
    "Acid": "ácido", "Bludgeoning": "contundente", "Cold": "frío", "Fire": "fuego", "Force": "fuerza",
    "Lightning": "relámpago", "Necrotic": "necrótico", "Piercing": "perforante", "Poison": "veneno",
    "Psychic": "psíquico", "Radiant": "radiante", "Slashing": "cortante", "Thunder": "trueno",
    # Rasgos de raza y de clase de lo más corriente
    "Darkvision": "Visión en la oscuridad", "Fey Ancestry": "Linaje feérico", "Skill Versatility": "Versatilidad en habilidades",
    "Trance": "Trance", "Keen Senses": "Sentidos agudos", "Lucky": "Suerte", "Brave": "Valiente",
    "Halfling Nimbleness": "Agilidad de mediano", "Dwarven Resilience": "Resistencia enana", "Stonecunning": "Afinidad con la piedra",
    "Relentless Endurance": "Aguante incansable", "Savage Attacks": "Ataques salvajes", "Hellish Resistance": "Resistencia infernal",
    "Infernal Legacy": "Legado infernal", "Breath Weapon": "Arma de aliento", "Damage Resistance": "Resistencia al daño",
    "Spellcasting": "Lanzamiento de conjuros", "Pact Magic": "Magia del pacto", "Sneak Attack": "Ataque furtivo",
    "Cunning Action": "Acción astuta", "Uncanny Dodge": "Esquiva asombrosa", "Evasion": "Evasión",
    "Expertise": "Pericia", "Rage": "Furia", "Unarmored Defense": "Defensa sin armadura", "Reckless Attack": "Ataque temerario",
    "Extra Attack": "Ataque adicional", "Second Wind": "Tomar aliento", "Action Surge": "Oleada de acción",
    "Fighting Style": "Estilo de combate", "Martial Arts": "Artes marciales", "Ki": "Ki", "Divine Sense": "Sentido divino",
    "Lay on Hands": "Imposición de manos", "Divine Smite": "Castigo divino", "Channel Divinity": "Canalizar divinidad",
    "Wild Shape": "Forma salvaje", "Bardic Inspiration": "Inspiración bárdica", "Jack of All Trades": "Polivalente",
    "Song of Rest": "Canción de descanso", "Font of Magic": "Fuente de magia", "Metamagic": "Metamagia",
    "Sorcerous Origin": "Origen hechicero", "Arcane Recovery": "Recuperación arcana", "Eldritch Invocations": "Invocaciones sobrenaturales",
    "Sorcery Points": "Puntos de hechicería", "Convert Sorcery Points": "Convertir puntos de hechicería",
    "Sorcery Points (Metamagic Adept)": "Puntos de hechicería (Adepto metamágico)",
    "Metamagic - Quickened Spell": "Metamagia: Conjuro acelerado", "Metamagic - Twinned Spell": "Metamagia: Conjuro duplicado",
    "Metamagic - Heightened Spell": "Metamagia: Conjuro intensificado", "Metamagic - Careful Spell": "Metamagia: Conjuro cuidadoso",
    "Metamagic - Distant Spell": "Metamagia: Conjuro distante", "Metamagic - Subtle Spell": "Metamagia: Conjuro sutil",
    "Metamagic - Extended Spell": "Metamagia: Conjuro prolongado", "Metamagic - Empowered Spell": "Metamagia: Conjuro potenciado",
    "Unarmed Strike": "Ataque sin armas", "Flurry of Blows": "Ráfaga de golpes", "Patient Defense": "Defensa paciente",
    "Step of the Wind": "Paso del viento", "Stunning Strike": "Golpe aturdidor", "Hit Dice": "Dados de golpe",
    "Healing Hands": "Manos curativas", "Relentless Rage": "Furia incansable", "Divine Intervention": "Intervención divina",
    "Turn Undead": "Expulsar muertos vivientes", "Destroy Undead": "Destruir muertos vivientes",
    "Metamagic Adept": "Adepto metamágico", "Magical Guidance": "Guía mágica", "Alert": "Alerta", "Tough": "Duro",
    "War Caster": "Conjurador de guerra",
    "Sharpshooter": "Tirador de primera", "Great Weapon Master": "Maestro de armas a dos manos",
    "Resilient": "Resiliente", "Observant": "Observador", "Mobile": "Móvil", "Sentinel": "Centinela",
    "Polearm Master": "Maestro de armas de asta", "Crossbow Expert": "Experto en ballestas",
    "Fey Touched": "Toque feérico", "Shadow Touched": "Toque sombrío", "Skilled": "Habilidoso",
    "Acolyte": "Acólito", "Charlatan": "Charlatán", "Criminal": "Criminal", "Entertainer": "Artista",
    "Folk Hero": "Héroe del pueblo", "Guild Artisan": "Artesano gremial", "Hermit": "Ermitaño", "Noble": "Noble",
    "Outlander": "Forastero", "Sage": "Sabio", "Sailor": "Marinero", "Soldier": "Soldado", "Urchin": "Huérfano",
    "Inheritor": "Heredero", "Haunted One": "Atormentado",
    "Favored Enemy": "Enemigo predilecto", "Natural Explorer": "Explorador nato", "Ability Score Improvement": "Mejora de característica",
    # Objetos de lo más corriente
    "Backpack": "Mochila", "Bedroll": "Petate", "Rations (1 day)": "Raciones (1 día)", "Waterskin": "Odre",
    "Tinderbox": "Yesquero", "Torch": "Antorcha", "Rope, Hempen (50 feet)": "Cuerda de cáñamo (15 m)",
    "Rope, Silk (50 feet)": "Cuerda de seda (15 m)", "Crowbar": "Palanca", "Hammer": "Martillo", "Piton": "Pitón",
    "Candle": "Vela", "Lantern, Hooded": "Linterna sorda", "Oil (flask)": "Aceite (frasco)", "Vial": "Vial",
    "Healer's Kit": "Útiles de sanador", "Potion of Healing": "Poción de curación", "Grappling Hook": "Garfio",
    "Bucket": "Cubo", "Quiver": "Carcaj", "Arrows (20)": "Flechas (20)", "Arrows": "Flechas", "Bolts": "Virotes",
    "Component Pouch": "Bolsa de componentes", "Spellbook": "Libro de conjuros", "Holy Symbol": "Símbolo sagrado",
    "Arcane Focus": "Canalizador arcano", "Orb": "Orbe", "Clothes, Common": "Ropa común",
    "Clothes, Traveler's": "Ropa de viajero", "Clothing, cold weather": "Ropa de abrigo", "Mess Kit": "Escudilla",
    "Block and Tackle": "Polea y aparejo", "Shield": "Escudo", "Leather": "Armadura de cuero",
    "Leather Armor": "Armadura de cuero", "Studded Leather": "Cuero tachonado", "Chain Shirt": "Camisote de mallas",
    "Scale Mail": "Cota de escamas", "Breastplate": "Coraza", "Half Plate": "Semiplacas", "Chain Mail": "Cota de mallas",
    "Splint": "Bandas", "Plate": "Placas", "Hide": "Pieles", "Padded": "Acolchada", "Ring Mail": "Cota de anillas",
    "Buckler": "Rodela", "Elven Chain": "Cota élfica", "Bag of Holding": "Bolsa de contención",
    "Spell Scroll (1st Level)": "Pergamino de conjuro (nivel 1)", "Quartz": "Cuarzo",
    "Wand of the War Mage": "Varita del mago de guerra", "Ring of Evasion": "Anillo de evasión",
    "Ring of Protection": "Anillo de protección", "Cloak of Protection": "Capa de protección",
    "Robe of Stars": "Túnica de estrellas", "Ioun Stone of Awareness": "Piedra Ioun de alerta",
    "Boots of Elvenkind": "Botas élficas", "Cloak of Elvenkind": "Capa élfica", "Immovable Rod": "Vara inamovible",
    "Potion of Greater Healing": "Poción de curación mayor", "Alchemist's Fire (flask)": "Fuego de alquimista (frasco)",
    "Antitoxin (vial)": "Antitoxina (vial)", "Ball Bearings (bag of 1,000)": "Canicas (bolsa de 1000)",
    "Caltrops (bag of 20)": "Abrojos (bolsa de 20)", "Chalk (1 piece)": "Tiza (1 trozo)", "Ink (1 ounce bottle)": "Tinta (frasco)",
    "Ink Pen": "Pluma", "Paper (one sheet)": "Papel (una hoja)", "Parchment (one sheet)": "Pergamino (una hoja)",
    "Pouch": "Saquito", "Sack": "Saco", "Shovel": "Pala", "Signal Whistle": "Silbato", "Soap": "Jabón",
    "Tent, two-person": "Tienda para dos", "Blanket": "Manta", "Book": "Libro", "Flask or tankard": "Jarra",
    "Hunting Trap": "Trampa de caza", "Mirror, steel": "Espejo de acero", "Pole (10-foot)": "Pértiga (3 m)",
    "Lute": "Laúd", "Flute": "Flauta", "Pan Flute": "Flauta de pan", "Drum": "Tambor", "Lyre": "Lira",
    # Monedas
    "cp": "pc", "sp": "pp", "ep": "pe", "gp": "po", "pp": "ppt",
}

CONJUROS = {
    # Trucos
    "Acid Splash": "Salpicadura de ácido", "Blade Ward": "Protección contra armas", "Chill Touch": "Toque helado",
    "Dancing Lights": "Luces danzantes", "Druidcraft": "Saber druídico", "Eldritch Blast": "Descarga sobrenatural",
    "Fire Bolt": "Descarga de fuego", "Friends": "Amistad", "Guidance": "Orientación divina", "Light": "Luz",
    "Mage Hand": "Mano de mago", "Mending": "Reparar", "Message": "Mensaje", "Minor Illusion": "Ilusión menor",
    "Poison Spray": "Rociada venenosa", "Prestidigitation": "Prestidigitación", "Produce Flame": "Crear llama",
    "Ray of Frost": "Rayo de escarcha", "Resistance": "Resistencia", "Sacred Flame": "Llama sagrada",
    "Shillelagh": "Garrote", "Shocking Grasp": "Agarre electrizante", "Spare the Dying": "Piedad con los moribundos",
    "Thaumaturgy": "Taumaturgia", "Thorn Whip": "Látigo de espinas", "True Strike": "Impacto certero",
    "Vicious Mockery": "Burla cruel", "Toll the Dead": "Doblar a muerto", "Mind Sliver": "Astilla mental",
    "Shape Water": "Moldear agua", "Booming Blade": "Filo atronador", "Green-Flame Blade": "Filo de llama verde",
    "Sword Burst": "Estallido de espadas", "Word of Radiance": "Palabra radiante", "Frostbite": "Congelación",
    "Mold Earth": "Moldear tierra", "Control Flames": "Controlar llamas", "Gust": "Ráfaga", "Infestation": "Infestación",
    "Primal Savagery": "Salvajismo primigenio", "Create Bonfire": "Crear hoguera", "Thunderclap": "Trueno",
    # Nivel 1
    "Alarm": "Alarma", "Animal Friendship": "Amistad con los animales", "Bane": "Perdición", "Bless": "Bendecir",
    "Burning Hands": "Manos ardientes", "Charm Person": "Hechizar persona", "Chromatic Orb": "Orbe cromático",
    "Color Spray": "Rociada de color", "Command": "Orden imperiosa", "Comprehend Languages": "Comprensión idiomática",
    "Create or Destroy Water": "Crear o destruir agua", "Cure Wounds": "Curar heridas",
    "Detect Evil and Good": "Detectar el bien y el mal", "Detect Magic": "Detectar magia",
    "Detect Poison and Disease": "Detectar venenos y enfermedades", "Disguise Self": "Disfrazarse",
    "Dissonant Whispers": "Susurros discordantes", "Divine Favor": "Favor divino", "Entangle": "Enmarañar",
    "Expeditious Retreat": "Retirada expeditiva", "Faerie Fire": "Fuego feérico", "False Life": "Vida falsa",
    "Feather Fall": "Caída de pluma", "Find Familiar": "Encontrar familiar", "Fog Cloud": "Nube de niebla",
    "Goodberry": "Bayas buenas", "Grease": "Grasa", "Guiding Bolt": "Saeta guía", "Healing Word": "Palabra de curación",
    "Hellish Rebuke": "Represión infernal", "Heroism": "Heroísmo", "Hex": "Maleficio", "Hunter's Mark": "Marca del cazador",
    "Identify": "Identificar", "Illusory Script": "Escritura ilusoria", "Inflict Wounds": "Infligir heridas",
    "Jump": "Salto", "Longstrider": "Zancada prodigiosa", "Mage Armor": "Armadura de mago",
    "Magic Missile": "Proyectil mágico", "Protection from Evil and Good": "Protección contra el bien y el mal",
    "Purify Food and Drink": "Purificar comida y bebida", "Sanctuary": "Santuario", "Shield": "Escudo",
    "Shield of Faith": "Escudo de fe", "Silent Image": "Imagen silenciosa", "Sleep": "Dormir",
    "Speak with Animals": "Hablar con los animales", "Tasha's Hideous Laughter": "Risa horrible de Tasha",
    "Thunderwave": "Onda atronadora", "Unseen Servant": "Sirviente invisible", "Witch Bolt": "Rayo de bruja",
    "Chaos Bolt": "Descarga del caos", "Ice Knife": "Cuchillo de hielo", "Absorb Elements": "Absorber elementos",
    "Armor of Agathys": "Armadura de Agathys", "Arms of Hadar": "Brazos de Hadar", "Ensnaring Strike": "Golpe atrapador",
    "Hail of Thorns": "Granizo de espinas", "Wrathful Smite": "Castigo colérico", "Thunderous Smite": "Castigo atronador",
    "Searing Smite": "Castigo abrasador", "Compelled Duel": "Duelo obligado", "Catapult": "Catapulta",
    "Earth Tremor": "Temblor de tierra",
    # Nivel 2
    "Aid": "Ayuda", "Alter Self": "Alterar el propio aspecto", "Arcane Lock": "Cerradura arcana",
    "Augury": "Augurio", "Barkskin": "Piel robliza", "Blindness/Deafness": "Ceguera/sordera", "Blur": "Desenfocar",
    "Calm Emotions": "Calmar emociones", "Darkness": "Oscuridad", "Darkvision": "Visión en la oscuridad",
    "Detect Thoughts": "Detectar pensamientos", "Enhance Ability": "Potenciar característica",
    "Enlarge/Reduce": "Agrandar/reducir", "Find Steed": "Encontrar montura", "Flame Blade": "Filo flamígero",
    "Flaming Sphere": "Esfera llameante", "Gust of Wind": "Ráfaga de viento", "Heat Metal": "Calentar metal",
    "Hold Person": "Inmovilizar persona", "Invisibility": "Invisibilidad", "Knock": "Apertura",
    "Lesser Restoration": "Restablecimiento menor", "Levitate": "Levitar", "Locate Object": "Localizar objeto",
    "Magic Mouth": "Boca mágica", "Magic Weapon": "Arma mágica", "Melf's Acid Arrow": "Flecha ácida de Melf",
    "Mirror Image": "Imagen múltiple", "Misty Step": "Paso brumoso", "Moonbeam": "Rayo de luna",
    "Pass without Trace": "Pasar sin dejar rastro", "Prayer of Healing": "Plegaria de curación",
    "Ray of Enfeeblement": "Rayo debilitador", "Scorching Ray": "Rayo abrasador", "See Invisibility": "Ver invisibilidad",
    "Shatter": "Romper", "Silence": "Silencio", "Spider Climb": "Trepar cual arácnido", "Spiritual Weapon": "Arma espiritual",
    "Suggestion": "Sugestión", "Web": "Telaraña", "Zone of Truth": "Zona de verdad", "Mind Spike": "Púa mental",
    "Shadow Blade": "Hoja de sombras", "Dragon's Breath": "Aliento de dragón", "Healing Spirit": "Espíritu sanador",
    # Nivel 3
    "Animate Dead": "Animar a los muertos", "Beacon of Hope": "Faro de esperanza", "Bestow Curse": "Imponer maldición",
    "Blink": "Intermitencia", "Call Lightning": "Llamar al relámpago", "Clairvoyance": "Clarividencia",
    "Counterspell": "Contraconjuro", "Daylight": "Luz del día", "Dispel Magic": "Disipar magia", "Fear": "Miedo",
    "Fireball": "Bola de fuego", "Fly": "Volar", "Gaseous Form": "Forma gaseosa", "Glyph of Warding": "Glifo custodio",
    "Haste": "Acelerar", "Hypnotic Pattern": "Patrón hipnótico", "Lightning Bolt": "Relámpago",
    "Major Image": "Imagen mayor", "Mass Healing Word": "Palabra de curación en masa",
    "Protection from Energy": "Protección contra energía", "Remove Curse": "Levantar maldición",
    "Revivify": "Revivir", "Sending": "Recado", "Sleet Storm": "Tormenta de aguanieve", "Slow": "Ralentizar",
    "Speak with Dead": "Hablar con los muertos", "Spirit Guardians": "Espíritus guardianes",
    "Stinking Cloud": "Nube apestosa", "Tongues": "Don de lenguas", "Vampiric Touch": "Toque vampírico",
    "Water Breathing": "Respirar bajo el agua", "Water Walk": "Caminar sobre el agua", "Hunger of Hadar": "Hambre de Hadar",
    "Conjure Animals": "Conjurar animales", "Plant Growth": "Crecimiento vegetal",
    # Nivel 4
    "Arcane Eye": "Ojo arcano", "Banishment": "Destierro", "Blight": "Marchitar", "Confusion": "Confusión",
    "Death Ward": "Custodia contra la muerte", "Dimension Door": "Puerta dimensional", "Divination": "Adivinación",
    "Fire Shield": "Escudo de fuego", "Freedom of Movement": "Libertad de movimiento",
    "Greater Invisibility": "Invisibilidad mayor", "Ice Storm": "Tormenta de hielo", "Polymorph": "Polimorfar",
    "Stoneskin": "Piel pétrea", "Wall of Fire": "Muro de fuego", "Sickening Radiance": "Radiancia nauseabunda",
    "Raulothim's Psychic Lance": "Lanza psíquica de Raulothim", "Private Sanctum": "Santuario privado",
    "Guardian of Faith": "Guardián de la fe", "Locate Creature": "Localizar criatura",
    # Nivel 5
    "Cone of Cold": "Cono de frío", "Dominate Person": "Dominar persona", "Flame Strike": "Columna flamígera",
    "Greater Restoration": "Restablecimiento mayor", "Hold Monster": "Inmovilizar monstruo",
    "Mass Cure Wounds": "Curar heridas en masa", "Raise Dead": "Revivir a los muertos", "Scrying": "Escudriñar",
    "Seeming": "Apariencia", "Telekinesis": "Telequinesis", "Teleportation Circle": "Círculo de teletransportación",
    "Wall of Force": "Muro de fuerza", "Wall of Stone": "Muro de piedra", "Synaptic Static": "Estática sináptica",
    "Animate Objects": "Animar objetos", "Cloudkill": "Nube aniquiladora", "Dream": "Sueño", "Geas": "Geas",
    "Modify Memory": "Modificar recuerdo", "Commune": "Comunión", "Legend Lore": "Conocimiento de leyendas",
    "Warp Weave": "Deformar el tejido",
}


def _clave(texto):
    t = str(texto or "").strip().lower().replace("’", "'")
    return re.sub(r"\s+", " ", t)


def _tabla():
    tabla = {}
    for origen in (TERMINOS, CONJUROS):
        for k, v in origen.items():
            tabla[_clave(k)] = v
    try:
        propias = json.loads(PROPIAS.read_text(encoding="utf-8"))
        for k, v in (propias or {}).items():
            if isinstance(v, str) and v.strip():
                tabla[_clave(k)] = v.strip()
    except (OSError, ValueError):
        pass
    return tabla


class Traductor:
    """traducir(«Fire Bolt») -> «Descarga de fuego». Lo que no sabe lo
    devuelve igual y lo apunta en .sin_traducir (para el aviso)."""

    def __init__(self):
        self.tabla = _tabla()
        self.sin_traducir = []

    def __call__(self, texto, apuntar=True):
        texto = str(texto or "").strip()
        if not texto:
            return ""
        hallado = self.tabla.get(_clave(texto))
        if hallado:
            return hallado
        # «Wand of the War Mage, +1»: la parte de antes de la coma y lo de
        # detrás tal cual (los +1 no se traducen).
        if "," in texto:
            antes, despues = texto.split(",", 1)
            if _clave(antes) in self.tabla and re.fullmatch(r"\s*\+\d+\s*", despues):
                return self.tabla[_clave(antes)] + "," + despues
        if apuntar and texto not in self.sin_traducir:
            self.sin_traducir.append(texto)
        return texto
