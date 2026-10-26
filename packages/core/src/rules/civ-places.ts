import type { PlaceKind } from "./places.js";

/**
 * Each civilization's own names for the places it finds first on a generated world (asked for
 * 2026-10-26: "more creative - a list of real earth and fantasy known worlds names - each civ would own
 * its own land masses names, and in the custom world scenarios the civ that discover land mass first
 * would get to name it from the list it owns"): real places of its world and the lands, seas and
 * mountains of its myths and legends (all of them old enough to be anyone's; no modern books' worlds).
 * A premade world keeps its real names. `PLACE_RULES` says how each kind writes one ("the Sea of {name}").
 */
export interface CivPlaces {
  /** Continents and islands, written as they stand: its homeland first, then the lands of its legends and its world. */
  lands: string[];
  /** Oceans, seas, gulfs and lakes: a name the water's word goes with (the Ocean of Neptune, Lake Avernus). */
  waters: string[];
  /**
   * Landforms: a word the landform's noun follows (the Apennine Mountains, the Pomptine Marshes), by the kind
   * it suits; a kind whose own run out borrows the others'.
   */
  wilds: Partial<Record<PlaceKind, string[]>>;
}

export const CIV_PLACES: Readonly<Record<string, CivPlaces>> = {
  romans: {
    lands: ["Ausonia", "Hesperia", "Saturnia", "Ultima Thule", "Latium", "Taprobane", "Britannia", "Hibernia", "Mauretania", "Germania", "Dacia", "Arabia Felix"],
    waters: ["Neptune", "Oceanus", "Salacia", "Portunus", "Tyrrhenus", "Hadria", "Ostia", "Misenum", "Avernus", "Trasimene"],
    wilds: {
      mountains: ["Apennine", "Sibylline", "Vulcanian"], hills: ["Alban", "Sabine"], desert: ["Libyan", "Getulian"],
      forest: ["Hercynian", "Ciminian"], swamp: ["Pomptine"], tundra: ["Sarmatian"], ice: ["Boreal"],
    },
  },
  babylonians: {
    lands: ["Sumer", "Dilmun", "Aratta", "Akkad", "Kur-Nugi", "Magan", "Meluhha", "Elam", "Subartu", "Amurru", "Gutium"],
    waters: ["Tiamat", "Apsu", "Marratu", "Nammu", "Enki", "Ziusudra", "Utnapishtim", "Euphrates", "Tigris", "Shamash"],
    wilds: {
      mountains: ["Mashu", "Nisir", "Ebih", "Amanus"], hills: ["Hamrin", "Lullubi"], desert: ["Martu", "Ninurta"],
      forest: ["Cedar", "Humbaba"], swamp: ["Sealand"],
    },
  },
  egyptians: {
    lands: ["Kemet", "Punt", "Aaru", "Ta-Seti", "Ta-Neter", "Kush", "Keftiu", "Retjenu", "Wawat", "Yam", "Ta-Mehu", "Ta-Shemau"],
    waters: ["Nun", "Wadj-wer", "Mehet-Weret", "Hapi", "Sobek", "Tefnut", "Khnum", "Osiris", "Moeris", "Mareotis"],
    wilds: {
      mountains: ["Bakhu", "Manu", "Benben"], hills: ["Theban"], desert: ["Deshret", "Set", "Tjehenu"],
      forest: ["Hathor"], jungle: ["Nubian"], swamp: ["Khemmis"],
    },
  },
  greeks: {
    lands: ["Hellas", "Hyperborea", "Atlantis", "Arcadia", "Elysium", "Scheria", "Ogygia", "Aiaia", "Erytheia", "Thule", "Colchis", "Taurica"],
    waters: ["Poseidon", "Thalassa", "Okeanos", "Tethys", "Pontus", "Amphitrite", "Nereus", "Proteus", "Triton", "Styx"],
    wilds: {
      mountains: ["Olympian", "Parnassian", "Pindus", "Titan", "Cyclopean"], hills: ["Arcadian", "Pelion"], desert: ["Ammon"],
      forest: ["Dodona", "Nemean"], swamp: ["Stymphalian", "Lernaean"], tundra: ["Scythian"], ice: ["Hyperborean"],
    },
  },
  chinese: {
    lands: ["Shenzhou", "Penglai", "Huaxia", "Fusang", "Yingzhou", "Fangzhang", "Daiyu", "Yuanqiao", "Jiuzhou", "Xiyu", "Tianzhu", "Liuqiu"],
    waters: ["Ao Guang", "Guixu", "Jingwei", "Bohai", "Donghai", "Nanhai", "Dongting", "Poyang", "Taihu", "Xihu"],
    wilds: {
      mountains: ["Kunlun", "Buzhou", "Tai", "Emei", "Hua", "Qinling"], hills: ["Wuyi", "Huangshan"], desert: ["Taklamakan", "Lop"],
      forest: ["Jianmu"], jungle: ["Xishuang"], swamp: ["Yunmeng"], tundra: ["Beiming"],
    },
  },
  indians: {
    lands: ["Bharata", "Jambudvipa", "Lanka", "Suvarnadvipa", "Plakshadvipa", "Kushadvipa", "Shakadvipa", "Kraunchadvipa", "Pushkaradvipa", "Aryavarta", "Kalinga", "Dravida"],
    waters: ["Varuna", "Samudra", "Ratnakara", "Kshira", "Sagara", "Mahodadhi", "Ganga", "Sarasvati", "Manasa", "Pushkar"],
    wilds: {
      mountains: ["Meru", "Himavat", "Kailasa", "Vindhya", "Mandara", "Malaya"], hills: ["Nilgiri", "Aravalli"], desert: ["Thar", "Maru"],
      forest: ["Dandaka", "Khandava", "Naimisha"], jungle: ["Sundarban", "Kamyaka"], swamp: ["Rann"], ice: ["Hima"],
    },
  },
  aztecs: {
    lands: ["Anahuac", "Aztlan", "Tamoanchan", "Tlalocan", "Cemanahuac", "Tollan", "Tlapallan", "Chicomoztoc", "Mictlan", "Xoconochco", "Huastecapan", "Totonacapan"],
    waters: ["Ilhuicaatl", "Chalchiuhtlicue", "Huixtocihuatl", "Atlacamani", "Tlaloc", "Atlaua", "Texcoco", "Xaltocan", "Zumpango", "Chalco"],
    wilds: {
      mountains: ["Popocatepetl", "Iztaccihuatl", "Citlaltepetl", "Matlalcueye", "Xinantecatl"], hills: ["Coatepec", "Tepeyac", "Ajusco"],
      desert: ["Teotlalpan"], forest: ["Mixcoatl"], jungle: ["Olman"], swamp: ["Chinampa"], tundra: ["Mictlampa"], ice: ["Itztlacoliuhqui"],
    },
  },
  zulus: {
    lands: ["KwaZulu", "Uhlanga", "Emakhosini", "Mzansi", "Nguni", "Ndwandwe", "Mthethwa", "Qwabe", "Thembu", "Mpondo"],
    waters: ["Mamlambo", "Inkanyamba", "Thukela", "Mfolozi", "Mzimvubu", "Pongola", "Mkhuze", "Mhlathuze", "Sibaya", "Nhlange"],
    wilds: {
      mountains: ["Khahlamba", "Lebombo", "Qudeni"], hills: ["Babanango", "Nquthu"], desert: ["Kalahari"],
      forest: ["Nkandla", "Ngome", "Ntendeka"], jungle: ["Hluhluwe"], swamp: ["Muzi"],
    },
  },
  germans: {
    lands: ["Saxony", "Schlaraffenland", "Vineta", "Rungholt", "Franconia", "Swabia", "Thuringia", "Bavaria", "Frisia", "Prussia", "Pomerania", "Helgoland"],
    waters: ["Lorelei", "Undine", "Rhine", "Danube", "Elbe", "Weser", "Oder", "Constance", "Starnberg", "Ammer"],
    wilds: {
      mountains: ["Harz", "Ore", "Brocken", "Taunus", "Eifel", "Fichtel"], hills: ["Swabian", "Thuringian"],
      forest: ["Black", "Teutoburg", "Spessart", "Bavarian"], swamp: ["Spree"], ice: ["Holle"],
    },
  },
  americans: {
    lands: ["Columbia", "Fredonia", "Lemuria", "Appalachia", "Louisiana", "Oregon", "Dakota", "Alaska", "Carolina", "Virginia", "Montana", "Vermont"],
    waters: ["Chesapeake", "Hudson", "Potomac", "Mississippi", "Pontchartrain", "Erie", "Huron", "Ontario", "Champlain", "Tahoe"],
    wilds: {
      mountains: ["Rocky", "Appalachian", "Adirondack", "Catskill", "Shasta"], hills: ["Ozark", "Blue Ridge"], desert: ["Painted", "Mojave", "Sonoran"],
      forest: ["Redwood", "Sequoia"], swamp: ["Everglade", "Okefenokee"], tundra: ["Yukon"], ice: ["Denali"],
    },
  },
  russians: {
    lands: ["Rus", "Buyan", "Belovodye", "Lukomorye", "Kitezh", "Muscovy", "Siberia", "Yugra", "Kamchatka", "Tartary", "Ruthenia", "Novaya Zemlya"],
    waters: ["Sadko", "Rusalka", "Vodyanoy", "Volga", "Ladoga", "Onega", "Ilmen", "Baikal", "Svetloyar", "Pechora"],
    wilds: {
      mountains: ["Ural", "Sayan", "Khibiny", "Koschei"], hills: ["Valdai", "Sparrow"], forest: ["Murom", "Bryansk", "Karelian"],
      swamp: ["Pripet", "Vasyugan"], tundra: ["Taimyr", "Yamal"], ice: ["Morozko"],
    },
  },
  french: {
    lands: ["Gaul", "Ys", "Cocagne", "Armorica", "Aquitaine", "Brittany", "Burgundy", "Normandy", "Provence", "Gascony", "Champagne", "Acadia"],
    waters: ["Melusine", "Loire", "Seine", "Rhone", "Garonne", "Dordogne", "Charente", "Leman", "Annecy", "Bourget"],
    wilds: {
      mountains: ["Vosges", "Jura", "Cevennes", "Pyrenean", "Auvergne"], hills: ["Morvan", "Perche"],
      forest: ["Broceliande", "Ardennes", "Fontainebleau", "Landes"], swamp: ["Camargue", "Poitevin"], ice: ["Chamonix"],
    },
  },
  english: {
    lands: ["Albion", "Avalon", "Logres", "Lyonesse", "Utopia", "Cockaigne", "Erewhon", "New Albion", "Mercia", "Wessex", "Northumbria", "Cornwall"],
    waters: ["Nimue", "Thames", "Severn", "Humber", "Mersey", "Solent", "Tamar", "Avon", "Windermere", "Coniston"],
    wilds: {
      mountains: ["Pennine", "Cheviot", "Cambrian"], hills: ["Cotswold", "Chiltern", "Mendip", "Malvern"],
      forest: ["Sherwood", "Arden", "Epping"], swamp: ["Fenland", "Romney"], tundra: ["Dartmoor", "Exmoor"],
    },
  },
  mongols: {
    lands: ["Ergune Kun", "Ordos", "Dzungaria", "Kipchak", "Transoxiana", "Khwarazm", "Uriankhai", "Merkit", "Kereit", "Tangut", "Khitan", "Onggirat"],
    waters: ["Dalai", "Tengis", "Kherlen", "Onon", "Orkhon", "Selenge", "Khovsgol", "Uvs", "Khyargas", "Buir"],
    wilds: {
      mountains: ["Burkhan", "Khangai", "Khentii", "Altai", "Otgon"], hills: ["Bogd", "Tengri"], desert: ["Gobi", "Gurvan"],
      forest: ["Darkhad"], ice: ["Kharkhiraa"],
    },
  },
  spanish: {
    lands: ["Hispania", "El Dorado", "Cibola", "Quivira", "Antillia", "California", "Iberia", "Castile", "Aragon", "Navarre", "Andalusia", "Patagonia"],
    waters: ["Cantabria", "Alboran", "Gades", "Tagus", "Ebro", "Duero", "Guadalquivir", "Albufera", "Sanabria", "Gallocanta"],
    wilds: {
      mountains: ["Nevada", "Cantabrian", "Guadarrama", "Morena", "Gredos", "Picos"], hills: ["Alcarria"], desert: ["Tabernas", "Monegros", "Bardenas"],
      forest: ["Irati", "Muniellos"], jungle: ["Darien"], swamp: ["Donana"],
    },
  },
  vikings: {
    lands: ["Midgard", "Vinland", "Asgard", "Markland", "Helluland", "Vanaheim", "Alfheim", "Jotunheim", "Niflheim", "Muspelheim", "Svartalfheim", "Gardarike"],
    waters: ["Jormungandr", "Aegir", "Ran", "Njord", "Ginnungagap", "Hvergelmir", "Kattegat", "Skagerrak", "Vanern", "Mjosa"],
    wilds: {
      mountains: ["Jotun", "Dovre", "Kjolen", "Ymir"], hills: ["Hrungnir"], desert: ["Surt"],
      forest: ["Iron", "Myrk", "Yggdrasil"], tundra: ["Finnmark"], ice: ["Rime", "Hel"],
    },
  },
  hittites: {
    lands: ["Hatti", "Arzawa", "Kizzuwatna", "Ahhiyawa", "Wilusa", "Alashiya", "Lukka", "Mitanni", "Isuwa", "Kaska", "Hayasa", "Azzi"],
    waters: ["Aruna", "Hedammu", "Illuyanka", "Kumarbi", "Teshub", "Marassantiya", "Seha", "Hulaya", "Zuliya", "Astarpa"],
    wilds: {
      mountains: ["Ullikummi", "Hazzi", "Namni", "Taurus", "Tarhunt"], hills: ["Kaskean", "Sharruma", "Kummanni"], forest: ["Zippalanda"],
    },
  },
  persians: {
    lands: ["Airyana Vaejah", "Khwaniratha", "Turan", "Arezahi", "Savahi", "Fradadhafshu", "Vidadhafshu", "Vourubarshti", "Vourujarshti", "Parthia", "Bactria", "Sogdia"],
    waters: ["Vourukasha", "Puitika", "Anahita", "Ardvisura", "Apam Napat", "Tishtrya", "Hyrcania", "Kansaoya", "Urmia", "Hamun"],
    wilds: {
      mountains: ["Alborz", "Qaf", "Damavand", "Zagros", "Hara", "Simurgh"], hills: ["Kopet"], desert: ["Kavir", "Lut"],
      forest: ["Hyrcanian"], swamp: ["Sistan"],
    },
  },
  hebrews: {
    lands: ["Canaan", "Eden", "Ophir", "Havilah", "Tarshish", "Goshen", "Sheba", "Nod", "Gilead", "Bashan", "Galilee", "Judea"],
    waters: ["Tehom", "Leviathan", "Rahab", "Kinneret", "Jordan", "Merom", "Pishon", "Gihon", "Kishon", "Arnon"],
    wilds: {
      mountains: ["Sinai", "Horeb", "Zion", "Hermon", "Lebanon"], hills: ["Carmel", "Gilboa", "Judean"], desert: ["Negev", "Paran", "Zin", "Shur"],
      forest: ["Ephraim", "Hereth"], swamp: ["Huleh"],
    },
  },
  japanese: {
    lands: ["Yamato", "Onogoro", "Tokoyo", "Takamagahara", "Horai", "Akitsushima", "Ashihara", "Izumo", "Tsukushi", "Ezo", "Ryukyu", "Yomi"],
    waters: ["Watatsumi", "Ryujin", "Toyotama", "Suijin", "Seto", "Ise", "Sagami", "Suruga", "Biwa", "Kasumi"],
    wilds: {
      mountains: ["Fuji", "Takachiho", "Tengu", "Hida", "Kiso", "Akaishi"], hills: ["Yoshino", "Hiei", "Koya"], desert: ["Tottori"],
      forest: ["Kumano"], jungle: ["Yaku"], swamp: ["Oze", "Kushiro"], tundra: ["Daisetsu"], ice: ["Yuki-onna"],
    },
  },
};
