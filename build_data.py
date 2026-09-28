"""
build_data.py
Converts parquet data files -> public/data/*.json for the Pokemon Champions VGC Learning App.
Run once locally, or via GitHub Actions before deploying.
"""
import pandas as pd
import json
import os

# Regulation M-C legal Pokemon (display name -> pokeapi db name mapping)
REG_MC_NAMES = {
    "Abomasnow": "abomasnow",
    "Absol": "absol",
    "Aegislash": "aegislash-shield",
    "Aerodactyl": "aerodactyl",
    "Aggron": "aggron",
    "Alakazam": "alakazam",
    "Alcremie": "alcremie",
    "Altaria": "altaria",
    "Ampharos": "ampharos",
    "Annihilape": "annihilape",
    "Appletun": "appletun",
    "Araquanid": "araquanid",
    "Arbok": "arbok",
    "Arboliva": "arboliva",
    "Arcanine": "arcanine",
    "Archaludon": "archaludon",
    "Ariados": "ariados",
    "Armarouge": "armarouge",
    "Aromatisse": "aromatisse",
    "Audino": "audino",
    "Aurorus": "aurorus",
    "Avalugg": "avalugg",
    "Azumarill": "azumarill",
    "Banette": "banette",
    "Barbaracle": "barbaracle",
    "Basculegion": "basculegion-male",
    "Bastiodon": "bastiodon",
    "Baxcalibur": "baxcalibur",
    "Beartic": "beartic",
    "Beedrill": "beedrill",
    "Bellibolt": "bellibolt",
    "Blastoise": "blastoise",
    "Blaziken": "blaziken",
    "Camerupt": "camerupt",
    "Castform": "castform",
    "Ceruledge": "ceruledge",
    "Chandelure": "chandelure",
    "Charizard": "charizard",
    "Chesnaught": "chesnaught",
    "Chimecho": "chimecho",
    "Cinderace": "cinderace",
    "Clawitzer": "clawitzer",
    "Clefable": "clefable",
    "Cofagrigus": "cofagrigus",
    "Conkeldurr": "conkeldurr",
    "Corviknight": "corviknight",
    "Crabominable": "crabominable",
    "Decidueye": "decidueye",
    "Dedenne": "dedenne",
    "Delphox": "delphox",
    "Diggersby": "diggersby",
    "Ditto": "ditto",
    "Dragalge": "dragalge",
    "Dragapult": "dragapult",
    "Drampa": "drampa",
    "Eelektross": "eelektross",
    "Emboar": "emboar",
    "Emolga": "emolga",
    "Empoleon": "empoleon",
    "Espathra": "espathra",
    "Espeon": "espeon",
    "Excadrill": "excadrill",
    "Falinks": "falinks",
    "Farfetch'd": "farfetchd",
    "Farfetch'd (Galar)": "farfetchd-galar",
    "Farigiraf": "farigiraf",
    "Feraligatr": "feraligatr",
    "Flapple": "flapple",
    "Flareon": "flareon",
    "Floette": "floette",
    "Florges": "florges",
    "Forretress": "forretress",
    "Froslass": "froslass",
    "Furfrou": "furfrou",
    "Gallade": "gallade",
    "Garbodor": "garbodor",
    "Garchomp": "garchomp",
    "Gardevoir": "gardevoir",
    "Garganacl": "garganacl",
    "Gengar": "gengar",
    "Gholdengo": "gholdengo",
    "Glaceon": "glaceon",
    "Glalie": "glalie",
    "Glimmora": "glimmora",
    "Gliscor": "gliscor",
    "Gogoat": "gogoat",
    "Golisopod": "golisopod",
    "Golurk": "golurk",
    "Goodra": "goodra",
    "Gourgeist": "gourgeist-average",
    "Grapploct": "grapploct",
    "Greninja": "greninja",
    "Grimmsnarl": "grimmsnarl",
    "Gyarados": "gyarados",
    "Hatterene": "hatterene",
    "Hawlucha": "hawlucha",
    "Heliolisk": "heliolisk",
    "Heracross": "heracross",
    "Hippowdon": "hippowdon",
    "Houndoom": "houndoom",
    "Houndstone": "houndstone",
    "Hydrapple": "hydrapple",
    "Hydreigon": "hydreigon",
    "Incineroar": "incineroar",
    "Indeedee (M)": "indeedee-male",
    "Indeedee (F)": "indeedee-female",
    "Infernape": "infernape",
    "Inteleon": "inteleon",
    "Jolteon": "jolteon",
    "Kangaskhan": "kangaskhan",
    "Kingambit": "kingambit",
    "Kleavor": "kleavor",
    "Klefki": "klefki",
    "Kommo-o": "kommo-o",
    "Krookodile": "krookodile",
    "Leafeon": "leafeon",
    "Liepard": "liepard",
    "Lopunny": "lopunny",
    "Lucario": "lucario",
    "Luxray": "luxray",
    "Lycanroc": "lycanroc-midday",
    "Mabosstiff": "mabosstiff",
    "Machamp": "machamp",
    "Malamar": "malamar",
    "Mamoswine": "mamoswine",
    "Manectric": "manectric",
    "Maushold": "maushold-family-of-four",
    "Mawile": "mawile",
    "Medicham": "medicham",
    "Meganium": "meganium",
    "Meowscarada": "meowscarada",
    "Meowstic (M)": "meowstic-male",
    "Meowstic (F)": "meowstic-female",
    "Metagross": "metagross",
    "Milotic": "milotic",
    "Mimikyu": "mimikyu-disguised",
    "Morpeko": "morpeko-full-belly",
    "Mr. Mime": "mr-mime",
    "Mr. Mime (Galar)": "mr-mime-galar",
    "Mr. Rime": "mr-rime",
    "Mudsdale": "mudsdale",
    "Musharna": "musharna",
    "Ninetales": "ninetales",
    "Noivern": "noivern",
    "Oranguru": "oranguru",
    "Orthworm": "orthworm",
    "Overqwil": "overqwil",
    "Palafin": "palafin-zero",
    "Pangoro": "pangoro",
    "Passimian": "passimian",
    "Patrat": "patrat",
    "Pawmot": "pawmot",
    "Pelipper": "pelipper",
    "Perrserker": "perrserker",
    "Persian": "persian",
    "Persian (Alola)": "persian-alola",
    "Pidgeot": "pidgeot",
    "Pikachu": "pikachu",
    "Pincurchin": "pincurchin",
    "Pinsir": "pinsir",
    "Politoed": "politoed",
    "Polteageist": "polteageist",
    "Primarina": "primarina",
    "Pyroar": "pyroar-male",
    "Quaquaval": "quaquaval",
    "Qwilfish": "qwilfish",
    "Raichu": "raichu",
    "Rampardos": "rampardos",
    "Reuniclus": "reuniclus",
    "Rhyperior": "rhyperior",
    "Rillaboom": "rillaboom",
    "Roserade": "roserade",
    "Rotom": "rotom",
    "Runerigus": "runerigus",
    "Sableye": "sableye",
    "Salamence": "salamence",
    "Salazzle": "salazzle",
    "Samurott": "samurott",
    "Sandaconda": "sandaconda",
    "Sceptile": "sceptile",
    "Scizor": "scizor",
    "Scolipede": "scolipede",
    "Scovillain": "scovillain",
    "Scrafty": "scrafty",
    "Serperior": "serperior",
    "Sharpedo": "sharpedo",
    "Simipour": "simipour",
    "Simisage": "simisage",
    "Simisear": "simisear",
    "Sinistcha": "sinistcha",
    "Sirfetch'd": "sirfetchd",
    "Skarmory": "skarmory",
    "Skeledirge": "skeledirge",
    "Slowbro": "slowbro",
    "Slurpuff": "slurpuff",
    "Sneasler": "sneasler",
    "Snorlax": "snorlax",
    "Spiritomb": "spiritomb",
    "Squawkabilly": "squawkabilly-green-plumage",
    "Staraptor": "staraptor",
    "Starmie": "starmie",
    "Steelix": "steelix",
    "Stunfisk": "stunfisk",
    "Swalot": "swalot",
    "Swampert": "swampert",
    "Sylveon": "sylveon",
    "Talonflame": "talonflame",
    "Tauros": "tauros",
    "Thievul": "thievul",
    "Tinkaton": "tinkaton",
    "Torkoal": "torkoal",
    "Torterra": "torterra",
    "Toucannon": "toucannon",
    "Toxapex": "toxapex",
    "Toxicroak": "toxicroak",
    "Toxtricity": "toxtricity-amped",
    "Toxtricity (Low Key)": "toxtricity-low-key",
    "Trevenant": "trevenant",
    "Tsareena": "tsareena",
    "Typhlosion": "typhlosion",
    "Tyranitar": "tyranitar",
    "Tyrantrum": "tyrantrum",
    "Umbreon": "umbreon",
    "Vanilluxe": "vanilluxe",
    "Vaporeon": "vaporeon",
    "Venusaur": "venusaur",
    "Victreebel": "victreebel",
    "Vileplume": "vileplume",
    "Vivillon": "vivillon",
    "Volcarona": "volcarona",
    "Weavile": "weavile",
    "Whimsicott": "whimsicott",
    "Wigglytuff": "wigglytuff",
    "Wyrdeer": "wyrdeer",
    "Zoroark": "zoroark",
}

def build_pokemon_json():
    pokemon_df = pd.read_parquet("data/pokemon.parquet")
    stats_df = pd.read_parquet("data/pokemon_stats.parquet")
    types_df = pd.read_parquet("data/pokemon_types.parquet")
    name_to_row = {row["name"]: row for _, row in pokemon_df.iterrows()}
    result = []
    for display_name, db_name in REG_MC_NAMES.items():
        if db_name not in name_to_row:
            print(f"  [WARN] Not found in DB: {db_name} ({display_name})")
            continue
        row = name_to_row[db_name]
        pid = int(row["id"])
        pstats = stats_df[stats_df["pokemon_id"] == pid]
        stats = {}
        for _, srow in pstats.iterrows():
            stats[srow["stat"]] = int(srow["base_stat"])
        ptypes = types_df[types_df["pokemon_id"] == pid].sort_values("slot")
        types = [t["type"] for _, t in ptypes.iterrows()]
        result.append({
            "id": pid,
            "name": display_name,
            "db_name": db_name,
            "types": types,
            "stats": {
                "hp": stats.get("hp", 0),
                "attack": stats.get("attack", 0),
                "defense": stats.get("defense", 0),
                "sp_attack": stats.get("special-attack", 0),
                "sp_defense": stats.get("special-defense", 0),
                "speed": stats.get("speed", 0),
            },
            "sprite": f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{pid}.png",
            "sprite_fallback": f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{pid}.png",
        })
    result.sort(key=lambda x: x["name"])
    print(f"Built pokemon.json: {len(result)} Pokemon")
    return result

def build_abilities_json():
    abilities_df = pd.read_parquet("data/pokemon_abilities.parquet")
    pokemon_df = pd.read_parquet("data/pokemon.parquet")
    name_to_id = {row["name"]: int(row["id"]) for _, row in pokemon_df.iterrows()}
    result = {}
    for display_name, db_name in REG_MC_NAMES.items():
        if db_name not in name_to_id:
            continue
        pid = name_to_id[db_name]
        pabs = abilities_df[abilities_df["pokemon_id"] == pid].sort_values("slot")
        abilities = []
        for _, arow in pabs.iterrows():
            abilities.append({
                "slot": int(arow["slot"]),
                "name": arow["ability"],
                "is_hidden": bool(arow["is_hidden"]),
            })
        result[display_name] = abilities
    print(f"Built abilities.json: {len(result)} Pokemon with abilities")
    return result

NATURES = [
    {"name": "Hardy",   "boost": None,        "reduce": None,        "neutral": True},
    {"name": "Lonely",  "boost": "attack",    "reduce": "defense",   "neutral": False},
    {"name": "Brave",   "boost": "attack",    "reduce": "speed",     "neutral": False},
    {"name": "Adamant", "boost": "attack",    "reduce": "sp_attack", "neutral": False},
    {"name": "Naughty", "boost": "attack",    "reduce": "sp_defense","neutral": False},
    {"name": "Bold",    "boost": "defense",   "reduce": "attack",    "neutral": False},
    {"name": "Docile",  "boost": None,        "reduce": None,        "neutral": True},
    {"name": "Relaxed", "boost": "defense",   "reduce": "speed",     "neutral": False},
    {"name": "Impish",  "boost": "defense",   "reduce": "sp_attack", "neutral": False},
    {"name": "Lax",     "boost": "defense",   "reduce": "sp_defense","neutral": False},
    {"name": "Timid",   "boost": "speed",     "reduce": "attack",    "neutral": False},
    {"name": "Hasty",   "boost": "speed",     "reduce": "defense",   "neutral": False},
    {"name": "Serious", "boost": None,        "reduce": None,        "neutral": True},
    {"name": "Jolly",   "boost": "speed",     "reduce": "sp_attack", "neutral": False},
    {"name": "Naive",   "boost": "speed",     "reduce": "sp_defense","neutral": False},
    {"name": "Modest",  "boost": "sp_attack", "reduce": "attack",    "neutral": False},
    {"name": "Mild",    "boost": "sp_attack", "reduce": "defense",   "neutral": False},
    {"name": "Quiet",   "boost": "sp_attack", "reduce": "speed",     "neutral": False},
    {"name": "Bashful", "boost": None,        "reduce": None,        "neutral": True},
    {"name": "Rash",    "boost": "sp_attack", "reduce": "sp_defense","neutral": False},
    {"name": "Calm",    "boost": "sp_defense","reduce": "attack",    "neutral": False},
    {"name": "Gentle",  "boost": "sp_defense","reduce": "defense",   "neutral": False},
    {"name": "Sassy",   "boost": "sp_defense","reduce": "speed",     "neutral": False},
    {"name": "Careful", "boost": "sp_defense","reduce": "sp_attack", "neutral": False},
    {"name": "Quirky",  "boost": None,        "reduce": None,        "neutral": True},
]

TYPES = ["normal","fire","water","electric","grass","ice","fighting","poison",
         "ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"]

TYPE_CHART_MATRIX = [
    [1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1, .5,  0,  1,  1, .5,  1],
    [1, .5, .5,  1,  2,  2,  1,  1,  1,  1,  1,  2, .5,  1, .5,  1,  2,  1],
    [1,  2, .5,  1, .5,  1,  1,  1,  2,  1,  1,  1,  2,  1, .5,  1,  1,  1],
    [1,  1,  2, .5, .5,  1,  1,  1,  0,  2,  1,  1,  1,  1, .5,  1,  1,  1],
    [1, .5,  2,  1, .5,  1,  1, .5,  2, .5,  1, .5,  2,  1, .5,  1, .5,  1],
    [1, .5, .5,  1,  2, .5,  1,  1,  2,  2,  1,  1,  1,  1,  2,  1, .5,  1],
    [2,  1,  1,  1,  1,  2,  1, .5,  1, .5, .5, .5,  2,  0,  1,  2,  2, .5],
    [1,  1,  1,  1,  2,  1,  1, .5, .5,  1,  1,  1,  1, .5,  1,  1,  0,  2],
    [1,  2,  1,  2, .5,  1,  1,  2,  1,  0,  1,  1,  2,  1,  1,  1,  2,  1],
    [1,  1,  1, .5,  2,  1,  2,  1,  1,  1,  1,  2, .5,  1,  1,  1, .5,  1],
    [1,  1,  1,  1,  1,  1,  2,  2,  1,  1, .5,  1,  1,  1,  1,  0, .5,  1],
    [1, .5,  1,  1,  2,  1, .5, .5,  1, .5,  2,  1, .5,  1,  1,  2, .5, .5],
    [1,  2,  1,  1,  1,  2, .5,  1, .5,  2,  1,  2,  1,  1,  1,  1, .5,  1],
    [0,  1,  1,  1,  1,  1,  1,  1,  1,  1,  2,  1,  1,  2,  1, .5,  1,  1],
    [1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  2,  1, .5,  0],
    [1,  1,  1,  1,  1,  1, .5,  1,  1,  1,  2,  1,  1,  2,  1, .5,  1, .5],
    [1, .5, .5, .5,  1,  2,  1,  1,  1,  1,  1,  1,  2,  1,  1,  1, .5,  2],
    [1, .5,  1,  1,  1,  1,  2, .5,  1,  1,  1,  1,  1,  1,  2,  2, .5,  1],
]

def build_type_chart():
    chart = {}
    for i, attacker in enumerate(TYPES):
        chart[attacker] = {}
        for j, defender in enumerate(TYPES):
            chart[attacker][defender] = TYPE_CHART_MATRIX[i][j]
    return {"types": TYPES, "chart": chart}

if __name__ == "__main__":
    os.makedirs("public/data", exist_ok=True)
    print("Building pokemon.json...")
    pokemon = build_pokemon_json()
    with open("public/data/pokemon.json", "w", encoding="utf-8") as f:
        json.dump(pokemon, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  -> public/data/pokemon.json ({os.path.getsize('public/data/pokemon.json'):,} bytes)")
    print("Building abilities.json...")
    abilities = build_abilities_json()
    with open("public/data/abilities.json", "w", encoding="utf-8") as f:
        json.dump(abilities, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  -> public/data/abilities.json ({os.path.getsize('public/data/abilities.json'):,} bytes)")
    print("Building natures.json...")
    with open("public/data/natures.json", "w", encoding="utf-8") as f:
        json.dump(NATURES, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  -> public/data/natures.json")
    print("Building type_chart.json...")
    type_chart = build_type_chart()
    with open("public/data/type_chart.json", "w", encoding="utf-8") as f:
        json.dump(type_chart, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  -> public/data/type_chart.json")
    print("\nAll data files built successfully!")

