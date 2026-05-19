// ===== ARCS =====
const ARCS = [
  "Romance Dawn","Orange Town","Syrup Village","Baratie","Arlong Park",
  "Loguetown","Reverse Mountain","Whisky Peak","Little Garden","Drum Island",
  "Alabasta","Jaya","Skypiea","Long Ring Long Land","Water 7","Enies Lobby",
  "Post-Enies Lobby","Thriller Bark","Sabaody","Amazon Lily","Impel Down",
  "Marineford","Post-Guerre","Fish-Man Island","Punk Hazard","Dressrosa",
  "Zou","Whole Cake Island","Wano","Egghead"
];

// ===== PERSONNAGES =====
const CHARACTERS = [
  { name:"Monkey D. Luffy",        img:["luffy","luffy_g4","luffy_g5"], emoji:["🌊","😁","⚡","🍖","🏴‍☠️","🤸","⭐","👒"], epithet:"Chapeau de Paille",        gender:"M", affil:"Chapeau de Paille",     origin:"East Blue",  fruit:"Zoan", haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:1,  bounty:3000 },
  { name:"Roronoa Zoro",           img:["zoro_pre","zoro_ts"], emoji:["😴","🍶","🧭","🟢","⚔️","💪","🎌","🗡️"], epithet:"Chasseur de Pirates",      gender:"M", affil:"Chapeau de Paille",     origin:"East Blue",  fruit:null,        haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:1,  bounty:1111 },
  { name:"Nami",                   img:["nami_pre","nami_ts"], emoji:["💰","⛅","🗺️","🍊","🌩️","💛","👙","🌪️"], epithet:"Chatte Voleuse",         gender:"F", affil:"Chapeau de Paille",     origin:"East Blue",  fruit:null,        haki:[],                                      status:"Vivant", arc:2,  bounty:366  },
  { name:"Usopp",                  img:["usopp_pre","usopp_ts"], emoji:["🌿","😰","🎭","👃","🏹","⭐","💚","🎯"], epithet:"Dieu",                  gender:"M", affil:"Chapeau de Paille",     origin:"East Blue",  fruit:null,        haki:["Observation"],                         status:"Vivant", arc:3,  bounty:500  },
  { name:"Sanji",                  img:["sanji_pre","sanji_ts"], emoji:["🍽️","❤️","🚬","🦵","🔥","💛","👠","👨‍🍳"], epithet:"Jambe Noire",            gender:"M", affil:"Chapeau de Paille",     origin:"North Blue", fruit:null,        haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:4,  bounty:1032 },
  { name:"Tony Tony Chopper",      img:["chopper_pre","chopper_ts"], emoji:["🏔️","💊","🍭","💙","🩺","🦌","🎩","🌡️"], epithet:"",       gender:"M", affil:"Chapeau de Paille",     origin:"Grand Line", fruit:"Zoan",      haki:[],                                      status:"Vivant", arc:10, bounty:0    },
  { name:"Nico Robin",             img:["robin_pre","robin","robin2","robin_ts"], emoji:["🏛️","📚","🌸","✋","👁️","🦋","🌺","🖤"], epithet:"Le Démon d'Ohara", gender:"F", affil:"Chapeau de Paille",     origin:"Grand Line", fruit:"Paramecia", haki:["Armement","Observation"],              status:"Vivant", arc:11, bounty:930  },
  { name:"Franky",                 img:["franky_pre","franky_ts"], emoji:["🏗️","🔧","🥤","🌟","💪","🔵","🤖","💥"], epithet:"",              gender:"M", affil:"Chapeau de Paille",     origin:"South Blue", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:15, bounty:394  },
  { name:"Brook",                  img:["brook","brook_ts"], emoji:["🎸","🎵","🎩","🎻","🩻","🖤","🗡️","💀"], epithet:"Soul King",              gender:"M", affil:"Chapeau de Paille",     origin:"West Blue",  fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:18, bounty:383  },
  { name:"Jinbe",                  img:["jinbe","jinbe_ts"], emoji:["☀️","🐠","🏊","🌊","🤜","💙","🐋","🐟"], epithet:"Paladin des Mers",         gender:"M", affil:"Chapeau de Paille",     origin:"Grand Line", fruit:null,        haki:["Armement","Observation"],              status:"Vivant", arc:22, bounty:1100 },
  { name:"Shanks",                 img:"shanks",  emoji:["🍻","🌊","🤝","⚔️","💪","🔴","🦱","🎩"], epithet:"Le Roux",              gender:"M", affil:"Pirates Roux",           origin:"West Blue",  fruit:null,        haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:1,  bounty:4048 },
  { name:"Marshall D. Teach",      img:"teach",      emoji:["🌑","💀","💔","🌊","💥","🖤","🧔","⚫"], epithet:"Barbe Noire",              gender:"M", affil:"Yonko",                 origin:"Grand Line", fruit:"Logia",     haki:["Armement"],                            status:"Vivant", arc:12, bounty:3996 },
  { name:"Charlotte Linlin",       img:"big_mom", emoji:["🏰","🍭","👵","👻","⚡","🔥","🎂","🩸"], epithet:"Big Mom",                     gender:"F", affil:"Yonko",                 origin:"North Blue", fruit:"Paramecia", haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:25, bounty:4388 },
  { name:"Kaido",                  img:"kaido",   emoji:["🐲","💀","🏯","🍶","⛩️","🌩️","🟣","🐉"], epithet:"",                gender:"M", affil:"Beast Pirates",          origin:"Grand Line", fruit:"Zoan",      haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:26, bounty:4611 },
  { name:"Trafalgar D. Water Law", img:"law",      emoji:["🌊","⚕️","🫀","🔵","✂️","🗡️","💙","☠️"], epithet:"Chirurgien de la Mort",      gender:"M", affil:"Pirates du Cœur",         origin:"North Blue", fruit:"Paramecia", haki:["Armement","Observation"],              status:"Vivant", arc:19, bounty:3000 },
  { name:"Eustass Kid",            img:"kid",      emoji:["🧲","⚙️","💢","🔩","🦾","🔴","⚡","🩸"], epithet:"",                  gender:"M", affil:"Kid Pirates",           origin:"South Blue", fruit:"Paramecia", haki:["Armement","Conquérant"],               status:"Vivant", arc:19, bounty:3000 },
  { name:"Portgas D. Ace",         img:"ace",     emoji:["🔥","😊","🌊","🧡","✊","🕊️","🧢","☠️"], epithet:"",                gender:"M", affil:"Barbe Blanche",         origin:"East Blue",  fruit:"Logia",     haki:["Armement","Observation","Conquérant"], status:"Mort",   arc:11, bounty:550  },
  { name:"Edward Newgate",         img:"whitebeard",emoji:["💥","🌍","👨‍👧","🔱","🤍","💪","🧔","☠️"], epithet:"Barbe Blanche",             gender:"M", affil:"Barbe Blanche",         origin:"Grand Line", fruit:"Paramecia", haki:["Armement","Observation","Conquérant"], status:"Mort",   arc:22, bounty:5046 },
  { name:"Sabo",                   img:"sabo",    emoji:["✊","🎩","🐲","🌍","🔥","🔵","👦","⚓"], epithet:"",             gender:"M", affil:"Armée Révolutionnaire", origin:"East Blue",  fruit:"Logia",     haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:21, bounty:602  },
  { name:"Boa Hancock",            img:"hancock", emoji:["🐍","❤️","👑","💅","💕","🏹","👸","💎"], epithet:"Impératrice Pirate",      gender:"F", affil:"Sept Grands Corsaires", origin:"Grand Line", fruit:"Paramecia", haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:20, bounty:1659 },
  { name:"Dracule Mihawk",         img:"mihawk",      emoji:["🦅","🌑","🏰","🍷","⚔️","🟡","👁️","🗡️"], epithet:"Oeil de Faucon",           gender:"M", affil:"Croix Noire",           origin:"West Blue",  fruit:null,        haki:["Armement","Observation"],              status:"Vivant", arc:4,  bounty:3590 },
  { name:"Donquixote Doflamingo",  img:"doflamingo",      emoji:["🦩","🧵","😏","👓","🌸","👑","🎪","🩷"], epithet:"Démon Céleste",        gender:"M", affil:"Donquixote Pirates",    origin:"North Blue", fruit:"Paramecia", haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:12, bounty:340  },
  { name:"Crocodile",              img:"crocodile",emoji:["🏜️","💨","🚬","🪝","🐊","⚫","💎","🌵"], epithet:"Roi du Désert",               gender:"M", affil:"Baroque Works",         origin:"Grand Line", fruit:"Logia",     haki:["Armement"],                            status:"Vivant", arc:8,  bounty:1965 },
  { name:"Gecko Moria",            img:"moria",   emoji:["🌑","🧟","🏚️","🦇","⚫","🕳️","🌊","👻"], epithet:"Corsaire",                     gender:"M", affil:"Sept Grands Corsaires", origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:18, bounty:320  },
  { name:"Aokiji (Kuzan)",         img:"aokiji",  emoji:["🧊","😴","🚲","⚖️","🔵","❄️","🌊","🌡️"], epithet:"Amiral des Glaces",            gender:"M", affil:"Indépendant",           origin:"Grand Line", fruit:"Logia",     haki:["Armement","Observation"],              status:"Vivant", arc:14, bounty:0    },
  { name:"Kizaru (Borsalino)",     img:"kizaru",  emoji:["💡","😪","🌟","⚡","💛","🔫","☀️","✨"], epithet:"Amiral des Lumières",          gender:"M", affil:"Marine",                origin:"Grand Line", fruit:"Logia",     haki:["Armement","Observation"],              status:"Vivant", arc:19, bounty:0    },
  { name:"Akainu (Sakazuki)",      img:"sakazuki",emoji:["🌋","🔥","⚖️","🐕","🧱","🔴","😠","☠️"], epithet:"Amiral de la Flotte",          gender:"M", affil:"Marine",                origin:"Grand Line", fruit:"Logia",     haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:22, bounty:0    },
  { name:"Fujitora (Issho)",       img:"fujitora",emoji:["🎲","🌌","⬇️","🟣","🎯","⚔️","🌠","☄️"], epithet:"Flancs d'Acier",               gender:"M", affil:"Marine",                origin:"Grand Line", fruit:"Paramecia", haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:26, bounty:0    },
  { name:"Garp",                   img:"garp",    emoji:["👴","✊","💪","⚓","🌊","👊","🧢","🏅"], epithet:"Héros des Marines",             gender:"M", affil:"Marine",                origin:"East Blue",  fruit:null,        haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:17, bounty:0    },
  { name:"Rayleigh",               img:"rayleigh",emoji:["⚫","🌟","👴","⚓","🎓","⚔️","💪","🌊"], epithet:"Roi des Ténèbres",              gender:"M", affil:"Indépendant",           origin:"East Blue",  fruit:null,        haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:19, bounty:0    },
  { name:"Charlotte Katakuri",     img:"katakuri",emoji:["🎯","🍩","🔮","🟤","😤","🧁","🔱","🫓"], epithet:"Mochi",                        gender:"M", affil:"Big Mom Pirates",       origin:"New World",  fruit:"Paramecia", haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:28, bounty:1057 },
  { name:"Yamato",                 img:"yamato",  emoji:["❄️","🐺","🏯","🔱","🌨️","🤍","🎏","⛩️"], epithet:"Princesse Oni",                gender:"F", affil:"Wano",                  origin:"New World",  fruit:"Zoan",      haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:29, bounty:0    },
  { name:"Smoker",                 img:"smoker",  emoji:["🌫️","💨","🚬","⚓","🤍","🏃","⚔️","🌪️"], epithet:"Chasseur Blanc",               gender:"M", affil:"Marine",                origin:"Grand Line", fruit:"Logia",     haki:["Armement","Observation"],              status:"Vivant", arc:6,  bounty:0    },
  { name:"Baggy",                  img:"buggy",   emoji:["🤡","🔵","✂️","🎪","🎊","💙","👃","🔴"], epithet:"",                     gender:"M", affil:"Pirates de Buggy",      origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:2,  bounty:3189 },
  { name:"Coby",                   img:"coby",    emoji:["😢","💪","⚓","🌊","🩷","🔵","🌟","👮"], epithet:"Héros des Marines",             gender:"M", affil:"Marine",                origin:"East Blue",  fruit:null,        haki:["Armement","Observation"],              status:"Vivant", arc:1,  bounty:0    },
  { name:"Nefertari Vivi",         img:"vivi",    emoji:["🏜️","👸","🦆","💙","🌊","🌺","🔵","👑"], epithet:"Princesse",                    gender:"F", affil:"Alabasta",              origin:"Grand Line", fruit:null,        haki:[],                                      status:"Vivant", arc:8,  bounty:0    },
  { name:"Bartolomeo",             img:"bartolomeo",      emoji:["😭","🌀","🛡️","💚","⭐","🧱","🟢","🏴‍☠️"], epithet:"Cannibale",            gender:"M", affil:"Barto Club",            origin:"East Blue",  fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:26, bounty:200  },
  { name:"Rob Lucci",              img:"lucci",   emoji:["🐆","🕊️","👤","🩸","⚫","👁️","🥋","🐱"], epithet:"CP0",                          gender:"M", affil:"CP0",                   origin:"Grand Line", fruit:"Zoan",      haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:15, bounty:0    },
  { name:"Killer",                 img:"killer",      emoji:["🎭","🔇","🌀","⚔️","😂","🔴","🌙","🪖"], epithet:"Soldat du Massacre",       gender:"M", affil:"Kid Pirates",           origin:"South Blue", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:19, bounty:200  },
  { name:"Jewelry Bonney",         img:"bonney",      emoji:["🍕","👵","👶","⏰","🌟","🍖","⏳","🔄"], epithet:"Grande Mangeuse",          gender:"F", affil:"Bonney Pirates",        origin:"South Blue", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:19, bounty:320  },
  { name:"Gol D. Roger",           img:"roger",   emoji:["💰","😁","⚔️","💀","🌊","🥇","👑","⚓"], epithet:"Roi des Pirates",              gender:"M", affil:"Pirates de Roger",         origin:"East Blue",  fruit:null,        haki:["Armement","Observation","Conquérant"], status:"Mort",   arc:1,  bounty:5564 },
  { name:"Kozuki Oden",            img:"oden",    emoji:["🏯","🫕","⚔️","🌊","🔓","🎌","🦁","🍲"], epithet:"Dieu de la Montagne",           gender:"M", affil:"Pirates de Roger",         origin:"New World",  fruit:"Paramecia", haki:["Armement","Observation","Conquérant"], status:"Mort",   arc:29, bounty:3900 },
  { name:"Scopper Gaban",          img:"gaban",      epithet:"Gorille Bleu",              gender:"M", affil:"Pirates de Roger",         origin:"Grand Line", fruit:null,        haki:["Armement","Observation"],              status:"Vivant", arc:1,  bounty:0    },
  { name:"Bartholomew Kuma",       img:"kuma",    emoji:["🐻","✝️","📖","🌊","🦾","🐾","👤","🤚"], epithet:"Tyran",                        gender:"M", affil:"Armée Révolutionnaire",      origin:"Grand Line", fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:18, bounty:0    },
  { name:"Emporio Ivankov",        img:"ivankov", emoji:["💉","🌈","👑","💋","🎪","🌀","💅","♾️"], epithet:"Roi des Okamas",               gender:"M", affil:"Armée Révolutionnaire", origin:"Grand Line", fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:21, bounty:0    },
  { name:"Inazuma",                img:"inazuma",      epithet:"",                        gender:"M", affil:"Armée Révolutionnaire", origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:21, bounty:0    },
  { name:"Monkey D. Dragon",       img:"dragon",  emoji:["🌪️","⚡","🌍","✊","👤","🐉","🎭","🔰"], epithet:"Pire Criminel du Monde",       gender:"M", affil:"Armée Révolutionnaire", origin:"East Blue",  fruit:null,        haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:6,  bounty:0    },
  { name:"Koala",                  img:"koala",   epithet:"",                             gender:"F", affil:"Armée Révolutionnaire", origin:"South Blue", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:23, bounty:0    },
  { name:"Basil Hawkins",          img:"hawkins",      emoji:["🃏","🌾","🔮","🩸","♟️","🎭","🎯","🪆"], epithet:"Magicien",                gender:"M", affil:"Hawkins Pirates",       origin:"North Blue", fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:19, bounty:320  },
  { name:"X Drake",                img:"drake",      emoji:["🦕","🔵","🕵️","⚔️","🔴","🌊","🦖","🐉"], epithet:"Drapeau Rouge",             gender:"M", affil:"Marine",                origin:"North Blue", fruit:"Zoan",      haki:["Armement","Observation"],              status:"Vivant", arc:19, bounty:222  },
  { name:"Scratchmen Apoo",        img:"apoo",      emoji:["🎵","🎹","🌊","👂","💥","🎶","🎺","🔊"], epithet:"Rugissement des Mers",       gender:"M", affil:"On Air Pirates",        origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:19, bounty:350  },
  { name:"Urouge",                 img:"urouge",      epithet:"Moine Fou",                gender:"M", affil:"Fallen Monk Pirates",   origin:"Skypiea",    fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:19, bounty:108  },
  { name:"Capone Bege",            img:"bege",      emoji:["🏰","🔫","🤵","💣","🎩","💥","🚗","🏯"], epithet:"Gang",                       gender:"M", affil:"Fire Tank Pirates",     origin:"West Blue",  fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:19, bounty:350  },
  { name:"Cavendish",              img:"cavendish",      emoji:["💇","🐴","⚔️","😴","💙","🌸","🤴","🏆"], epithet:"Prince des Pirates",    gender:"M", affil:"Grand Fleet",           origin:"North Blue", fruit:null,        haki:["Armement","Observation"],              status:"Vivant", arc:26, bounty:330  },
  { name:"Bellamy",                img:"bellamy",      emoji:["🌀","💛","😤","🌸","⚔️","🔄","🌟","🌊"], epithet:"Hyène",                   gender:"M", affil:"Pirates de Bellamy",    origin:"South Blue", fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:12, bounty:195  },
  { name:"Perona",                 img:"perona",  emoji:["👻","🌸","😭","🎀","🩷","💀","🏰","🦇"], epithet:"Princesse Fantôme",            gender:"F", affil:"Indépendant",           origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:18, bounty:0    },
  { name:"Hatchan",                img:"hatchan",      emoji:["🐙","🌊","🎣","💙","🍣","🐟","🦑","⚓"], epithet:"",               gender:"M", affil:"Pirates d'Arlong",      origin:"Grand Line", fruit:null,        haki:[],                                      status:"Vivant", arc:5,  bounty:0    },
  { name:"Arlong",                 img:"arlong",  emoji:["🦈","🔵","😠","💀","🌊","🪚","🐟","🌙"], epithet:"Dents de Scie",                gender:"M", affil:"Pirates d'Arlong",        origin:"Grand Line", fruit:null,        haki:[],                                      status:"Vivant", arc:5,  bounty:20   },
  { name:"Don Krieg",              img:"krieg",      emoji:["⚔️","🛡️","💥","🌊","😈","🧱","🔴","💣"], epithet:"Coup Déloyal",              gender:"M", affil:"Krieg Pirates",         origin:"East Blue",  fruit:null,        haki:[],                                      status:"Vivant", arc:4,  bounty:17   },
  { name:"Alvida",                 img:"alvida",      emoji:["🪨","🌊","💋","⚫","💄","💅","🪩","🫧"], epithet:"Masse de Fer",             gender:"F", affil:"Pirates d'Alvida",      origin:"East Blue",  fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:1,  bounty:6    },
  { name:"Helmeppo",               img:"helmeppo",      emoji:["😰","💪","⚓","🌊","🟡","👮","🌟","🎖️"], epithet:"",                       gender:"M", affil:"Marine",                origin:"East Blue",  fruit:null,        haki:["Armement","Observation"],              status:"Vivant", arc:1,  bounty:0    },
  { name:"Tashigi",                img:"tashigi",      emoji:["👓","⚔️","💙","🌸","😤","📖","🌊","⚓"], epithet:"",                        gender:"F", affil:"Marine",                origin:"East Blue",  fruit:null,        haki:["Armement","Observation"],              status:"Vivant", arc:6,  bounty:0    },
  { name:"Hina",                   img:"hina",      epithet:"Cage Noire",                 gender:"F", affil:"Marine",                origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:11, bounty:0    },
  { name:"Tsuru",                  img:"tsuru",      epithet:"Grand Officier",             gender:"F", affil:"Marine",                origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:22, bounty:0    },
  { name:"Sengoku",                img:"sengoku",      emoji:["🧘","🪖","⚖️","🐐","💛","🏛️","👴","🏅"], epithet:"Le Bouddha",              gender:"M", affil:"Marine",                origin:"Grand Line", fruit:"Zoan",      haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:22, bounty:0    },
  { name:"Ryokugyu (Aramaki)",     img:"ryokugyu",      emoji:["🌿","🌳","💚","🪖","🌾","🍃","🌱","🐂"], epithet:"Taureau Vert",           gender:"M", affil:"Marine",                origin:"Grand Line", fruit:"Logia",     haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:29, bounty:0    },
  { name:"Sentomaru",              img:"sentomaru",      emoji:["🥊","🪓","💪","⬜","🏋️","🌊","🛡️","🐻"], epithet:"",                      gender:"M", affil:"Marine",                origin:"Grand Line", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:19, bounty:0    },
  { name:"Caesar Clown",           img:"caesar",      emoji:["🧪","☁️","🟢","😈","💀","🔬","☠️","🧬"], epithet:"Maître",                   gender:"M", affil:"Indépendant",           origin:"Grand Line", fruit:"Logia",     haki:[],                                      status:"Vivant", arc:25, bounty:300  },
  { name:"Monet",                  img:"monet",      epithet:"",                          gender:"F", affil:"Donquixote Pirates",    origin:"Grand Line", fruit:"Logia",     haki:["Armement"],                            status:"Mort",   arc:25, bounty:0    },
  { name:"Sugar",                  img:"sugar",      epithet:"",                          gender:"F", affil:"Donquixote Pirates",    origin:"North Blue", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:26, bounty:0    },
  { name:"Trebol",                 img:"trebol",      epithet:"",                         gender:"M", affil:"Donquixote Pirates",    origin:"North Blue", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:26, bounty:0    },
  { name:"Pica",                   img:"pica",      epithet:"",                           gender:"M", affil:"Donquixote Pirates",    origin:"Grand Line", fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:26, bounty:0    },
  { name:"Diamante",               img:"diamante",      epithet:"",                       gender:"M", affil:"Donquixote Pirates",    origin:"Grand Line", fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:26, bounty:0    },
  { name:"Vergo",                  img:"vergo",      epithet:"",                          gender:"M", affil:"Marine",                origin:"Grand Line", fruit:null,        haki:["Armement"],                            status:"Mort",   arc:25, bounty:0    },
  { name:"Rebecca",                img:"rebecca", emoji:["⚔️","🩷","🏟️","🩰","🛡️","💔","💪","🌹"], epithet:"Imbattue",                     gender:"F", affil:"Dressrosa",             origin:"Grand Line", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:26, bounty:0    },
  { name:"Kyros",                  img:"kyros",      emoji:["🪆","⚔️","🦵","💪","🏟️","💔","🌹","🛡️"], epithet:"Ricky",                     gender:"M", affil:"Dressrosa",             origin:"Grand Line", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:26, bounty:0    },
  { name:"Viola",                  img:"viola",      epithet:"Violet",                    gender:"F", affil:"Dressrosa",             origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:26, bounty:0    },
  { name:"Pedro",                  img:"pedro",      emoji:["🐆","💥","🌙","🕯️","🌿","💀","🌺","⚡"], epithet:"Seigneur de la Nuit",       gender:"M", affil:"Mink Tribe",            origin:"New World",  fruit:null,        haki:["Armement","Observation"],              status:"Mort",   arc:28, bounty:382  },
  { name:"Carrot",                 img:"carrot",  emoji:["🐰","⚡","🌕","🦁","🌙","💛","🤸","🌊"], epithet:"",                             gender:"F", affil:"Mink Tribe",            origin:"New World",  fruit:null,        haki:["Observation"],                         status:"Vivant", arc:27, bounty:0    },
  { name:"Nekomamushi",            img:"neko",      emoji:["🌙","🐱","🦁","🌕","🐾","💪","🗡️","🌃"], epithet:"Seigneur de la Nuit",        gender:"M", affil:"Mink Tribe",            origin:"New World",  fruit:null,        haki:["Armement","Observation"],              status:"Vivant", arc:27, bounty:0    },
  { name:"Inuarashi",              img:"inuarashi",      emoji:["🌞","🐕","🦁","🌅","🦴","💪","⚔️","🏔️"], epithet:"",      gender:"M", affil:"Mink Tribe",            origin:"New World",  fruit:null,        haki:["Armement","Observation"],              status:"Vivant", arc:27, bounty:0    },
  { name:"Kozuki Momonosuke",      img:"momonosuke",      emoji:["🐲","👦","🏯","😭","🌸","🍱","👑","⛩️"], epithet:"Shogun",               gender:"M", affil:"Wano",                  origin:"New World",  fruit:"Zoan",      haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:25, bounty:0    },
  { name:"Kin'emon",               img:"kinemon",      emoji:["🦊","🔥","🎌","👘","🗡️","🎭","🌸","⛩️"], epithet:"Feu Renard",              gender:"M", affil:"Wano",                  origin:"New World",  fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:25, bounty:0    },
  { name:"Raizo",                  img:"raizo",      epithet:"",                     gender:"M", affil:"Wano",                  origin:"New World",  fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:27, bounty:0    },
  { name:"Denjiro",                img:"denjiro",      emoji:["😄","🗡️","🎭","🌸","🎌","👤","⛩️","🌑"], epithet:"Kyoshiro",                gender:"M", affil:"Wano",                  origin:"New World",  fruit:null,        haki:["Armement","Conquérant"],               status:"Vivant", arc:29, bounty:0    },
  { name:"Jack",                   img:"jack",    emoji:["🐘","🌵","💀","🔱","💥","🌊","🔩","⚡"], epithet:"La Sécheresse",                gender:"M", affil:"Beast Pirates",          origin:"Grand Line", fruit:"Zoan",      haki:["Armement"],                            status:"Vivant", arc:27, bounty:1000 },
  { name:"Queen",                  img:"queen",   emoji:["🎵","💉","🦕","🤖","🟡","🐛","🦠","🎸"], epithet:"La Peste",                     gender:"M", affil:"Beast Pirates",          origin:"Grand Line", fruit:"Zoan",      haki:["Armement"],                            status:"Vivant", arc:29, bounty:1320 },
  { name:"King",                   img:"king",    emoji:["🦕","🔥","🦅","⚫","🌋","🦴","🖤","🐲"], epithet:"Feu Sauvage",                  gender:"M", affil:"Beast Pirates",          origin:"Grand Line", fruit:"Zoan",      haki:["Armement","Conquérant"],               status:"Vivant", arc:29, bounty:1390 },
  { name:"Vegapunk",               img:"vegapunk",      emoji:["🧠","🔬","🤖","🌐","💡","⚗️","🧬","🌟"], epithet:"Le Génie",               gender:"M", affil:"Gouvernement Mondial",  origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Mort",   arc:30, bounty:0    },
  { name:"Shaka",                  img:"shaka",      epithet:"Vegapunk 01",               gender:"M", affil:"Gouvernement Mondial",  origin:"Grand Line", fruit:null,        haki:[],                                      status:"Mort",   arc:30, bounty:0    },
  { name:"Lilith",                 img:"lilith",  epithet:"Vegapunk 02",                  gender:"F", affil:"Gouvernement Mondial",  origin:"Grand Line", fruit:null,        haki:[],                                      status:"Vivant", arc:30, bounty:0    },
  { name:"Edison",                 img:"edison",      epithet:"Vegapunk 03",              gender:"M", affil:"Gouvernement Mondial",  origin:"Grand Line", fruit:null,        haki:[],                                      status:"Vivant", arc:30, bounty:0    },
  { name:"Pythagoras",             img:"pythagoras",      epithet:"Vegapunk 04",          gender:"M", affil:"Gouvernement Mondial",  origin:"Grand Line", fruit:null,        haki:[],                                      status:"Mort",   arc:30, bounty:0    },
  { name:"Atlas",                  img:"atlas",      epithet:"Vegapunk 05",               gender:"F", affil:"Gouvernement Mondial",  origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:30, bounty:0    },
  { name:"York",                   img:"york",    epithet:"Vegapunk 06",                  gender:"F", affil:"Gouvernement Mondial",  origin:"Grand Line", fruit:null,        haki:[],                                      status:"Vivant", arc:30, bounty:0    },
  { name:"Saint Jaygarcia Saturn", img:"saturn",      epithet:"Doyen",                    gender:"M", affil:"Gouvernement Mondial",  origin:"Grand Line", fruit:"Mythique",  haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:30, bounty:0    },
  { name:"Saint Marcus Mars",      img:"mars",      epithet:"Doyen",                      gender:"M", affil:"Gouvernement Mondial",  origin:"Grand Line", fruit:"Mythique",  haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:30, bounty:0    },
  { name:"Saint Topman Warcury",   img:"warcury",      epithet:"Doyen",                   gender:"M", affil:"Gouvernement Mondial",  origin:"Grand Line", fruit:"Mythique",  haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:30, bounty:0    },
  { name:"Saint Ethanbaron V. Nusjuro", img:"nusjuro", epithet:"Doyen",                   gender:"M", affil:"Gouvernement Mondial",  origin:"Grand Line", fruit:"Mythique",  haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:30, bounty:0    },
  { name:"Saint Shepherd Ju Peter",img:"ju_peter",      epithet:"Doyen",                  gender:"M", affil:"Gouvernement Mondial",  origin:"Grand Line", fruit:"Mythique",  haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:30, bounty:0    },
  { name:"Foxy",                   img:"foxy",    emoji:["🦊","⏰","😈","🎮","🐌","🪙","👃","💫"], epithet:"Renard d'Argent",               gender:"M", affil:"Foxy Pirates",          origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:14, bounty:24   },
  { name:"Kanjuro",                img:"kanjuro", epithet:"Calligraphe",                  gender:"M", affil:"Orochi",                origin:"New World",  fruit:"Paramecia", haki:[],                                      status:"Mort",   arc:27, bounty:0    },
  { name:"Nojiko",                 img:"nojiko",  epithet:"",                             gender:"F", affil:"Cocoyasi",              origin:"East Blue",  fruit:null,        haki:[],                                      status:"Vivant", arc:5,  bounty:0    },
  { name:"Uta",                    img:"uta",     epithet:"Diva",                          gender:"F", affil:"Indépendant",           origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Mort",   arc:1,  bounty:0    },
  // --- Personnages liés aux pavillons ---
  { name:"Kuro",                   img:"kuro",      emoji:["🐱","🕵️","🧤","💙","🔪","👔","🌙","⚫"], epithet:"Klahadore",                  gender:"M", affil:"Pirates du Chat Noir",   origin:"East Blue",  fruit:null,        haki:[],                                      status:"Vivant", arc:3,  bounty:16   },
  { name:"Wapol",                  img:"wapol",      emoji:["🍽️","🔫","❄️","🏔️","👑","😈","🤴","🦷"], epithet:"",             gender:"M", affil:"Pirates de Bliking",     origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:10, bounty:0    },
  { name:"Dorry",                  img:"dorry",      emoji:["🔵","⚔️","💪","🏝️","⏳","🤝","🦁","⚓"], epithet:"Ogre Bleu",                  gender:"M", affil:"Équipage des Géants",    origin:"Grand Line", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:9,  bounty:100  },
  { name:"Brogy",                  img:"brogy",      epithet:"Ogre Rouge",                 gender:"M", affil:"Équipage des Géants",    origin:"Grand Line", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:9,  bounty:100  },
  // --- Personnages majeurs additionnels ---
  { name:"Enel",                   img:"enel",    emoji:["⚡","👼","🥁","🌩️","💛","☁️","👑","🌤️"], epithet:"Dieu",                          gender:"M", affil:"Skypiea",               origin:"Grand Line", fruit:"Logia",     haki:[],                                      status:"Vivant", arc:13, bounty:0    },
  { name:"Bon Clay",               img:"bon_clay",emoji:["🦢","💃","🩰","🎭","🤸","🩷","👯","🦩"], epithet:"Mr. 2",                        gender:"M", affil:"Baroque Works",         origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:11, bounty:32   },
  { name:"Marco",                  img:"marco",   emoji:["💊","🔵","🔥","🦅","🔄","💙","🐦‍🔥","🌀"], epithet:"Le Phénix",                    gender:"M", affil:"Barbe Blanche",         origin:"Grand Line", fruit:"Mythique",  haki:["Armement","Observation"],              status:"Vivant", arc:22, bounty:1550 },
  { name:"Kaku",                   img:"kaku",    emoji:["🦒","🟫","⚔️","🔲","🕵️","🔧","🌀","🗡️"], epithet:"Onde Carrée",                  gender:"M", affil:"CP0",                   origin:"Grand Line", fruit:"Zoan",      haki:["Armement","Observation"],              status:"Vivant", arc:15, bounty:0    },
  { name:"Kalifa",                 img:"kalifa",      epithet:"",                         gender:"F", affil:"CP0",                   origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:15, bounty:0    },
  { name:"Spandam",                img:"spandam",      epithet:"",                        gender:"M", affil:"CP0",                   origin:"Grand Line", fruit:null,        haki:[],                                      status:"Vivant", arc:15, bounty:0    },
  { name:"Hody Jones",             img:"hody",      emoji:["💊","🦈","🌊","😤","⚪","🐟","💀","🌙"], epithet:"",                           gender:"M", affil:"New Fish-Man Pirates",  origin:"Grand Line", fruit:null,        haki:[],                                      status:"Vivant", arc:24, bounty:0    },
  { name:"Corazon",                img:"corazon",      emoji:["🤫","🚬","💙","❤️","🙈","🩺","💔","🕯️"], epithet:"Rosinante",               gender:"M", affil:"Marine",                origin:"North Blue", fruit:"Paramecia", haki:[],                                      status:"Mort",   arc:26, bounty:0    },
  { name:"Charlotte Pudding",      img:"pudding",      emoji:["👁️","🍫","😭","🎭","💕","🍮","🌸","👓"], epithet:"",              gender:"F", affil:"Big Mom Pirates",       origin:"New World",  fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:28, bounty:0    },
  { name:"Charlotte Cracker",      img:"cracker",      emoji:["🍪","🛡️","💪","🍰","💛","🏰","🍞","🧁"], epithet:"Mille Bras",              gender:"M", affil:"Big Mom Pirates",       origin:"New World",  fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:28, bounty:860  },
  { name:"Charlotte Smoothie",     img:"smoothie",      emoji:["🍹","💧","⚔️","🟡","🍋","🌴","💦","🥤"], epithet:"",                       gender:"F", affil:"Big Mom Pirates",       origin:"New World",  fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:28, bounty:932  },
  { name:"Nerona Imu",             img:"imu",          epithet:"",                        gender:"F", affil:"Gouvernement Mondial",   origin:"Grand Line", fruit:"Mythique",  haki:["Armement","Observation","Conquérant"], status:"Vivant", arc:28, bounty:0    },
  // --- Dressrosa — Donquixote Pirates ---
  { name:"Lao G",                  img:"lao_g",        epithet:"",                        gender:"M", affil:"Donquixote Pirates",     origin:"Grand Line", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:26, bounty:0    },
  { name:"Gladius",                img:"gladius",      epithet:"",                        gender:"M", affil:"Donquixote Pirates",     origin:"North Blue", fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:26, bounty:0    },
  { name:"Dellinger",              img:"dellinger",    epithet:"",                        gender:"M", affil:"Donquixote Pirates",     origin:"Grand Line", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:26, bounty:0    },
  { name:"Señor Pink",             img:"senor_pink",   epithet:"",                        gender:"M", affil:"Donquixote Pirates",     origin:"North Blue", fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:26, bounty:0    },
  { name:"Baby 5",                 img:"baby5",        epithet:"",                        gender:"F", affil:"Grand Fleet",            origin:"North Blue", fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:26, bounty:0    },
  { name:"Machvise",               img:"machvise",     epithet:"",                        gender:"M", affil:"Donquixote Pirates",     origin:"Grand Line", fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:26, bounty:0    },
  { name:"Giolla",                 img:"giolla",       epithet:"",                        gender:"F", affil:"Donquixote Pirates",     origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:26, bounty:0    },
  // --- Dressrosa — Royaume & Grand Fleet ---
  { name:"Riku Doldo III",         img:"riku",         epithet:"King Riku",               gender:"M", affil:"Dressrosa",              origin:"Grand Line", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:26, bounty:0    },
  { name:"Don Chinjao",            img:"chinjao",      emoji:["🔩","👊","💪","👴","🌊","💥","🏅","⚓"], epithet:"Perceuse",                gender:"M", affil:"Happou Navy",            origin:"Grand Line", fruit:null,        haki:["Armement","Conquérant"],               status:"Vivant", arc:26, bounty:542  },
  { name:"Sai",                    img:"sai",          epithet:"",                        gender:"M", affil:"Grand Fleet",            origin:"Grand Line", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:26, bounty:0    },
  { name:"Ideo",                   img:"ideo",         epithet:"",                        gender:"M", affil:"Grand Fleet",            origin:"Grand Line", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:26, bounty:0    },
  { name:"Orlumbus",               img:"orlumbus",     epithet:"Aventurier",              gender:"M", affil:"Grand Fleet",            origin:"Grand Line", fruit:null,        haki:[],                                      status:"Vivant", arc:26, bounty:148  },
  // --- Dressrosa — Tontatta ---
  { name:"Leo",                    img:"leo",          epithet:"Tontatta",                gender:"M", affil:"Grand Fleet",            origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:26, bounty:0    },
  { name:"Mansherry",              img:"mansherry",    epithet:"Princesse",               gender:"F", affil:"Grand Fleet",            origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:26, bounty:0    },
  // --- Barbe Blanche — Commandants ---
  { name:"Joz",                    img:"jozu",         emoji:["💎","💪","🌊","⚡","🔷","💙","🛡️","⚓"], epithet:"Diamant",                 gender:"M", affil:"Barbe Blanche",          origin:"Grand Line", fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:22, bounty:0    },
  { name:"Thatch",                 img:"thatch",       epithet:"",                        gender:"M", affil:"Barbe Blanche",          origin:"Grand Line", fruit:null,        haki:[],                                      status:"Mort",   arc:22, bounty:0    },
  { name:"Vista",                  img:"vista",        emoji:["🌹","⚔️","🌸","💙","🌺","🌷","💪","⚓"], epithet:"Épée Fleurie",            gender:"M", affil:"Barbe Blanche",          origin:"Grand Line", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:22, bounty:0    },
  { name:"Izo",                    img:"izo",          epithet:"",                        gender:"M", affil:"Barbe Blanche",          origin:"New World",  fruit:null,        haki:["Armement"],                            status:"Mort",   arc:22, bounty:0    },
  // --- Pirates de Barbe Noire ---
  { name:"Jesus Burgess",          img:"burgess",      epithet:"Champion",                gender:"M", affil:"Pirates de Barbe Noire", origin:"Grand Line", fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:12, bounty:0    },
  { name:"Shiryu",                 img:"shiryu",       emoji:["🗡️","🌧️","🔪","🕶️","💀","🌑","🫥","⚫"], epithet:"Pluie",                   gender:"M", affil:"Pirates de Barbe Noire", origin:"Grand Line", fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:22, bounty:0    },
  { name:"Van Augur",              img:"van_augur",    epithet:"",             gender:"M", affil:"Pirates de Barbe Noire", origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:12, bounty:0    },
  { name:"Avalo Pizarro",          img:"avalo_pizarro",epithet:"Roi Corrompu",             gender:"M", affil:"Pirates de Barbe Noire", origin:"Grand Line", fruit:"Logia",     haki:["Armement"],                            status:"Vivant", arc:22, bounty:0    },
  { name:"Laffitte",               img:"laffitte",     epithet:"Shérif Démon",             gender:"M", affil:"Pirates de Barbe Noire", origin:"West Blue",  fruit:"Zoan",      haki:[],                                      status:"Vivant", arc:12, bounty:0    },
  { name:"Catarina Devon",         img:"devon",        emoji:["🦊","🌙","🎭","😈","🌑","💀","🖤","🦹‍♀️"], epithet:"Croissant de Lune",        gender:"F", affil:"Pirates de Barbe Noire", origin:"Grand Line", fruit:"Mythique",  haki:["Armement"],                            status:"Vivant", arc:22, bounty:0    },
  { name:"Sanjuan Wolf",           img:"sanjuan_wolf", epithet:"Cuirassé Colossal",       gender:"M", affil:"Pirates de Barbe Noire", origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:22, bounty:0    },
  { name:"Vasco Shot",             img:"vasco_shot",   epithet:"Grand Buveur",             gender:"M", affil:"Pirates de Barbe Noire", origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:22, bounty:0    },
  { name:"Doc Q",                  img:"doc_q",        epithet:"Dieu de la Mort",          gender:"M", affil:"Pirates de Barbe Noire", origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:12, bounty:0    },
  // --- Pirates Roux ---
  { name:"Ben Beckman",            img:"ben_beckman",  emoji:["🔫","🎯","🟡","🍺","⚓","🌟","🧠","🔴"], epithet:"Second",                  gender:"M", affil:"Pirates Roux",           origin:"North Blue", fruit:null,        haki:["Armement","Observation"],              status:"Vivant", arc:1,  bounty:0    },
  { name:"Yasopp",                 img:"yasopp",       epithet:"Tireur d'Élite",           gender:"M", affil:"Pirates Roux",           origin:"East Blue",  fruit:null,        haki:["Observation"],                         status:"Vivant", arc:1,  bounty:0    },
  { name:"Lucky Roux",             img:"lucky_roux",   epithet:"",                        gender:"M", affil:"Pirates Roux",           origin:"Grand Line", fruit:null,        haki:[],                                      status:"Vivant", arc:1,  bounty:0    },
  // --- Impel Down ---
  { name:"Magellan",               img:"magellan",     emoji:["☠️","🐍","🟣","💀","🏛️","🔐","🐉","🧪"], epithet:"Geôlier Venimeux",         gender:"M", affil:"Gouvernement Mondial",   origin:"Grand Line", fruit:"Paramecia", haki:[],                                      status:"Vivant", arc:21, bounty:0    },
  // --- Wano — Méchants & Alliés ---
  { name:"Kurozumi Orochi",        img:"orochi",       emoji:["🐍","👑","🏯","😈","🌸","🗡️","⛩️","🐉"], epithet:"Shogun",                  gender:"M", affil:"Wano",                   origin:"New World",  fruit:"Mythique",  haki:[],                                      status:"Mort",   arc:29, bounty:0    },
  { name:"Kawamatsu",              img:"kawamatsu",    emoji:["🦦","🌊","🤼","🌸","🎌","🐟","⛩️","🔱"], epithet:"Le Kappa",                gender:"M", affil:"Wano",                   origin:"New World",  fruit:null,        haki:["Armement"],                            status:"Vivant", arc:29, bounty:0    },
  { name:"Ashura Doji",            img:"ashura_doji",  epithet:"Roi de la Montagne",       gender:"M", affil:"Wano",                   origin:"New World",  fruit:null,        haki:["Armement"],                            status:"Mort",   arc:29, bounty:0    },
  { name:"Hyogoro",                img:"hyogoro",      epithet:"La Fleur",                gender:"M", affil:"Wano",                   origin:"New World",  fruit:null,        haki:["Armement"],                            status:"Vivant", arc:29, bounty:0    },
  // --- Beast Pirates — Flying Six ---
  { name:"Ulti",                   img:"ulti",         emoji:["🦕","💥","👊","🩷","😤","🏯","🐉","💢"], epithet:"",                        gender:"F", affil:"Beast Pirates",          origin:"New World",  fruit:"Zoan",      haki:["Armement"],                            status:"Vivant", arc:29, bounty:0    },
  { name:"Who's Who",              img:"whos_who",     epithet:"",                        gender:"M", affil:"Beast Pirates",          origin:"Grand Line", fruit:"Zoan",      haki:["Armement"],                            status:"Vivant", arc:29, bounty:0    },
  { name:"Black Maria",            img:"black_maria",  epithet:"",                        gender:"F", affil:"Beast Pirates",          origin:"New World",  fruit:"Zoan",      haki:["Armement"],                            status:"Vivant", arc:29, bounty:0    },
  // --- Big Mom Pirates ---
  { name:"Perospero",              img:"perospero",    emoji:["🍭","🍬","🟡","🧡","🏰","🎂","🍰","🍡"], epithet:"Ministre des Bonbons",     gender:"M", affil:"Big Mom Pirates",        origin:"New World",  fruit:"Paramecia", haki:["Armement"],                            status:"Vivant", arc:28, bounty:700  },
  // --- Indépendant ---
  { name:"Edward Weevil",          img:"weevil",       emoji:["💪","🧔","👵","⚔️","💀","🤔","🌊","🌸"], epithet:"Barbe Blanche Jr",         gender:"M", affil:"Indépendant",            origin:"Grand Line", fruit:null,        haki:["Armement"],                            status:"Vivant", arc:27, bounty:480  },
  // --- Water 7 ---
  { name:"Iceburg",                img:"iceburg",      epithet:"",                        gender:"M", affil:"Water 7",                origin:"Grand Line", fruit:null,        haki:[],                                      status:"Vivant", arc:15, bounty:0    },
];

// ===== PAVILLONS =====
const FLAGS = [
  { name:"L'Équipage du Chapeau de Paille", file:"chapeau_de_paille",   captain:"Monkey D. Luffy"        },
  { name:"L'Équipage de Barbe Blanche",     file:"barbe_blanche",       captain:"Edward Newgate"         },
  { name:"L'Équipage des Pirates de Roger", file:"roger",               captain:"Gol D. Roger"           },
  { name:"L'Équipage du Cœur",              file:"heart",               captain:"Trafalgar D. Water Law" },
  { name:"Baroque Works",                   file:"baroque_works",       captain:"Crocodile"              },
  { name:"L'Équipage du Chat Noir",         file:"chat_noir",           captain:"Kuro"                   },
  { name:"L'Équipage des Géants",           file:"equipage_des_geants", captain:"Dorry & Brogy"          },
  { name:"L'Équipage du Fire Tank",         file:"capone",              captain:"Capone Bege"            },
  { name:"La Flotte de Don Krieg",          file:"don_krieg",           captain:"Don Krieg"              },
  // --- East Blue ---
  { name:"L'Équipage d'Alvida",             file:"alvida",              captain:"Alvida"                 },
  { name:"L'Équipage du Clown",             file:"buggy",               captain:"Baggy"                  },
  { name:"L'Équipage d'Arlong",             file:"arlong",              captain:"Arlong"                 },
  { name:"L'Équipage du Roux",              file:"rouge",               captain:"Shanks"                 },
  // --- Alabasta / Drum Island ---
  { name:"L'Équipage du Bliking",           file:"bliking",             captain:"Wapol"                  },
  // --- Jaya / Skypiea ---
  { name:"L'Équipage de Bellamy",           file:"bellamy",             captain:"Bellamy"                },
  // --- Post-Alabasta / Grand Line ---
  { name:"L'Équipage de Barbe Noire",       file:"barbe_noire",         captain:"Marshall D. Teach"      },
  { name:"L'Équipage des Pirates du Soleil",file:"pirates_du_soleil",   captain:"Fisher Tiger"           },
];

// ===== ALIASES (noms alternatifs pour la recherche) =====
// Chaque clé est une chaîne de recherche possible → nom officiel du personnage
const ALIASES = {
  // Vrai nom des amiraux
  "kuzan":           "Aokiji (Kuzan)",
  "borsalino":       "Kizaru (Borsalino)",
  "issho":           "Fujitora (Issho)",
  "aramaki":         "Ryokugyu (Aramaki)",
  "sakazuki":        "Akainu (Sakazuki)",
  // Noms alternatifs courants
  "bentham":         "Bon Clay",
  "bon kurei":       "Bon Clay",
  "mr 2":            "Bon Clay",
  "rosinante":       "Corazon",
  "corazon":         "Corazon",
  "gol roger":       "Gol D. Roger",
  "dr vegapunk":     "Vegapunk",
  // Surnoms français
  "poing de feu":    "Portgas D. Ace",
  "roi des pirates": "Gol D. Roger",
  "barbe blanche":   "Edward Newgate",
  "barbe noire":     "Marshall D. Teach",
  "chapeau de paille":"Monkey D. Luffy",
};

// ===== CONSTANTES =====
const BLUR_STEPS = [20, 16, 12, 9, 6, 3, 1, 0];
const MAX_GUESSES = 8;
const WANTED_CHARS = CHARACTERS.filter(c => c.img !== null && c.img !== undefined);

// Personnages exclusifs au mode Wanted (affiches spéciales, groupes, etc.)
// Non présents dans CHARACTERS → invisibles en mode Classique
const WANTED_EXTRA = [];
// WANTED_CHARS.push(...WANTED_EXTRA); // réservé pour futures affiches spéciales

// ===== HELPERS =====
function getImgFile(char) {
  if (!char.img) return null;
  if (Array.isArray(char.img)) {
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return char.img[seed % char.img.length];
  }
  return char.img;
}

// salt : nombre premier différent par mode pour éviter les collisions
function dailyPick(pool, salt = 1) {
  const d = new Date();
  const base = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const seed = (base * salt) >>> 0; // force entier non signé 32 bits
  return pool[seed % pool.length];
}

// ===== FRUITS DU DÉMON =====
const FRUITS = [
  // ── LOGIA ──
  { name:"Mera Mera no Mi",                    type:"Logia",          translated:"Fruit des Flammes",               description:"Transforme le porteur en feu. Il peut créer, contrôler et se transformer en flammes à volonté.",                              holder:"Sabo" },
  { name:"Hie Hie no Mi",                      type:"Logia",          translated:"Fruit de la Glace",               description:"Transforme le porteur en glace. Il peut tout geler d'un contact et créer des structures de glace massives.",              holder:"Aokiji (Kuzan)" },
  { name:"Pika Pika no Mi",                    type:"Logia",          translated:"Fruit de la Lumière",             description:"Transforme le porteur en lumière. Il peut se déplacer et attaquer à la vitesse de la lumière.",                          holder:"Kizaru (Borsalino)" },
  { name:"Magu Magu no Mi",                    type:"Logia",          translated:"Fruit du Magma",                  description:"Transforme le porteur en magma. C'est la Logia offensive la plus puissante, capable de brûler le feu lui-même.",       holder:"Akainu (Sakazuki)" },
  { name:"Goro Goro no Mi",                    type:"Logia",          translated:"Fruit du Tonnerre",               description:"Transforme le porteur en foudre. Il peut contrôler l'électricité à une tension de 200 millions de volts.",              holder:"Enel" },
  { name:"Suna Suna no Mi",                    type:"Logia",          translated:"Fruit du Sable",                  description:"Transforme le porteur en sable. Il peut assécher tout ce qu'il touche et créer des tempêtes de sable dévastatrices.",  holder:"Crocodile" },
  { name:"Moku Moku no Mi",                    type:"Logia",          translated:"Fruit de la Fumée",               description:"Transforme le porteur en fumée. Il peut contrôler sa densité pour immobiliser ou étouffer ses ennemis.",               holder:"Smoker" },
  { name:"Yami Yami no Mi",                    type:"Logia",          translated:"Fruit des Ténèbres",              description:"Transforme le porteur en ténèbres. Unique : il peut annuler les pouvoirs des autres fruits du démon.",                   holder:"Marshall D. Teach" },
  { name:"Gasu Gasu no Mi",                    type:"Logia",          translated:"Fruit du Gaz",                    description:"Transforme le porteur en gaz. Il peut créer tout type de gaz, dont des gaz toxiques mortels.",                         holder:"Caesar Clown" },
  { name:"Yuki Yuki no Mi",                    type:"Logia",          translated:"Fruit de la Neige",               description:"Transforme le porteur en neige. Il peut déclencher des tempêtes et se déplacer dans les airs.",                         holder:"Monet" },
  { name:"Mori Mori no Mi",                    type:"Logia",          translated:"Fruit de la Forêt",               description:"Transforme le porteur en végétation. Il peut créer et contrôler des plantes à volonté.",                               holder:"Ryokugyu (Aramaki)" },
  // ── PARAMECIA ──
  { name:"Hana Hana no Mi",                    type:"Paramecia",      translated:"Fruit de la Fleur",               description:"Permet de faire pousser des répliques de son corps sur n'importe quelle surface à portée de vue.",                       holder:"Nico Robin" },
  { name:"Yomi Yomi no Mi",                    type:"Paramecia",      translated:"Fruit de la Résurrection",        description:"Permet de revenir à la vie une seule fois après la mort. Développé, il permet de contrôler l'âme et le froid.",         holder:"Brook" },
  { name:"Ope Ope no Mi",                      type:"Paramecia",      translated:"Fruit de l'Opération",            description:"Crée une sphère blanche dans laquelle le porteur peut tout manipuler librement, comme un chirurgien tout-puissant.",      holder:"Trafalgar D. Water Law" },
  { name:"Jiki Jiki no Mi",                    type:"Paramecia",      translated:"Fruit du Magnétisme",             description:"Permet d'attirer et repousser le métal, et de créer de puissants champs magnétiques.",                                   holder:"Eustass Kid" },
  { name:"Gura Gura no Mi",                    type:"Paramecia",      translated:"Fruit du Séisme",                 description:"Permet de créer de puissantes vibrations sismiques déclenchant des tremblements de terre et des tsunamis.",            holder:"Marshall D. Teach" },
  { name:"Soru Soru no Mi",                    type:"Paramecia",      translated:"Fruit de l'Âme",                  description:"Permet d'extraire l'âme des gens qui ont peur du porteur et de l'insuffler dans des objets ou créatures.",            holder:"Charlotte Linlin" },
  { name:"Ito Ito no Mi",                      type:"Paramecia",      translated:"Fruit du Fil",                    description:"Permet de créer et contrôler des fils ultra-résistants capables de trancher la plupart des matériaux.",                 holder:"Donquixote Doflamingo" },
  { name:"Kage Kage no Mi",                    type:"Paramecia",      translated:"Fruit de l'Ombre",                description:"Permet de voler les ombres des autres et de les utiliser pour animer des corps sans vie.",                              holder:"Gecko Moria" },
  { name:"Mero Mero no Mi",                    type:"Paramecia",      translated:"Fruit de l'Amour",                description:"Transforme en pierre tout être qui ressent de l'amour ou de l'attirance envers le porteur.",                             holder:"Boa Hancock" },
  { name:"Zushi Zushi no Mi",                  type:"Paramecia",      translated:"Fruit de la Gravité",             description:"Permet de contrôler la gravité, attirant des météorites depuis l'espace ou écrasant ses ennemis au sol.",               holder:"Fujitora (Issho)" },
  { name:"Nikyu Nikyu no Mi",                  type:"Paramecia",      translated:"Fruit de la Patte",               description:"Permet de repousser tout ce que le porteur touche, y compris des concepts abstraits comme la douleur.",                  holder:"Bartholomew Kuma" },
  { name:"Horu Horu no Mi",                    type:"Paramecia",      translated:"Fruit de l'Hormone",              description:"Permet de créer et injecter des hormones modifiant les corps, pouvant même changer le genre d'une personne.",          holder:"Emporio Ivankov" },
  { name:"Bara Bara no Mi",                    type:"Paramecia",      translated:"Fruit de la Séparation",          description:"Permet de diviser son corps en morceaux flottant dans les airs, immunisant contre les coups tranchants.",               holder:"Buggy" },
  { name:"Mochi Mochi no Mi",                  type:"Paramecia",      translated:"Fruit du Mochi",                  description:"Permet de créer et contrôler du mochi. Paramecia Spécial fonctionnant comme un Logia.",                                 holder:"Charlotte Katakuri" },
  { name:"Bari Bari no Mi",                    type:"Paramecia",      translated:"Fruit de la Barrière",            description:"Permet de créer des barrières indestructibles capables de repousser toute attaque physique.",                           holder:"Bartolomeo" },
  { name:"Horo Horo no Mi",                    type:"Paramecia",      translated:"Fruit du Fantôme",                description:"Permet de créer des fantômes négatifs qui plongent leurs victimes dans une dépression profonde en 1 seconde.",         holder:"Perona" },
  { name:"Mane Mane no Mi",                    type:"Paramecia",      translated:"Fruit du Mime",                   description:"Permet d'imiter parfaitement l'apparence physique de toute personne touchée.",                                          holder:"Bon Clay" },
  { name:"Wara Wara no Mi",                    type:"Paramecia",      translated:"Fruit de la Paille",              description:"Permet de transférer les blessures reçues à des poupées de paille représentant d'autres personnes.",                    holder:"Basil Hawkins" },
  { name:"Shibo Shibo no Mi",                  type:"Paramecia",      translated:"Fruit de l'Essorage",             description:"Permet d'essorer tout être vivant pour en extraire les liquides, le déshydratant dangereusement.",                        holder:"Charlotte Smoothie" },
  { name:"Bis Bis no Mi",                      type:"Paramecia",      translated:"Fruit du Biscuit",                description:"Permet de créer d'immenses soldats en biscuit quasi indestructibles et d'en produire à l'infini.",                      holder:"Charlotte Cracker" },
  { name:"Memo Memo no Mi",                    type:"Paramecia",      translated:"Fruit de la Mémoire",             description:"Permet d'extraire et de manipuler les souvenirs des autres sous forme de film.",                                         holder:"Charlotte Pudding" },
  { name:"Nagi Nagi no Mi",                    type:"Paramecia",      translated:"Fruit du Silence",                description:"Permet de créer des zones de silence absolu dans lesquelles aucun son ne peut entrer ni sortir.",                        holder:"Corazon" },
  { name:"Choki Choki no Mi",                  type:"Paramecia",      translated:"Fruit des Ciseaux",               description:"Transforme les mains en ciseaux capables de découper n'importe quoi comme du papier, y compris l'acier.",               holder:"Inazuma" },
  { name:"Shiro Shiro no Mi",                  type:"Paramecia",      translated:"Fruit du Château",                description:"Transforme le porteur en forteresse mobile pouvant contenir des centaines de personnes et des armées entières.",         holder:"Capone Bege" },
  { name:"Sube Sube no Mi",                    type:"Paramecia",      translated:"Fruit du Glissant",               description:"Rend la peau du porteur si lisse que tous les coups et attaques glissent sur lui sans lui faire de mal.",               holder:"Alvida" },
  { name:"Baku Baku no Mi",                    type:"Paramecia",      translated:"Fruit de la Mâchoire",            description:"Permet de manger et d'absorber n'importe quel matériau puis de le fusionner à son propre corps.",                      holder:"Wapol" },
  { name:"Giro Giro no Mi",                    type:"Paramecia",      translated:"Fruit du Regard",                 description:"Permet de voir à travers tous les objets et les personnes, et de lire dans leurs pensées.",                             holder:"Viola" },
  { name:"Noro Noro no Mi",                    type:"Paramecia",      translated:"Fruit du Ralenti",                description:"Émet des photons ralentissant tout ce qu'ils touchent à 1/100e de leur vitesse normale pendant 30 secondes.",           holder:"Foxy" },
  { name:"Fude Fude no Mi",                    type:"Paramecia",      translated:"Fruit du Pinceau",                description:"Permet de donner vie aux dessins réalisés par le porteur, qui peuvent agir de manière autonome.",                       holder:"Kanjuro" },
  { name:"Bane Bane no Mi",                    type:"Paramecia",      translated:"Fruit du Ressort",                description:"Transforme les jambes du porteur en ressorts ultra-puissants, décuplant sa vitesse et sa force.",                        holder:"Bellamy" },
  { name:"Ori Ori no Mi",                      type:"Paramecia",      translated:"Fruit de la Cage",                description:"Permet de créer des menottes et barreaux en fer pour emprisonner les ennemis.",                                           holder:"Hina" },
  // ── ZOAN ──
  { name:"Hito Hito no Mi",                    type:"Zoan",           translated:"Fruit de l'Humain",               description:"Transforme son porteur en humain ou humain hybride, lui conférant une intelligence et un corps humain.",                holder:"Tony Tony Chopper" },
  { name:"Neko Neko no Mi: Model Léopard",     type:"Zoan",           translated:"Fruit du Chat : Léopard",         description:"Transforme le porteur en léopard ou en forme hybride, l'un des Zoans les plus puissants jamais vus.",                   holder:"Rob Lucci" },
  { name:"Ushi Ushi no Mi: Model Girafe",      type:"Zoan",           translated:"Fruit du Bœuf : Girafe",          description:"Transforme le porteur en girafe ou forme hybride, avec un cou et des jambes extensibles d'une longueur extrême.",      holder:"Kaku" },
  { name:"Zou Zou no Mi: Model Mammouth",      type:"Zoan Ancien",    translated:"Fruit de l'Éléphant : Mammouth",  description:"Transforme le porteur en mammouth préhistorique de taille gigantesque, doté d'une force brute phénoménale.",           holder:"Jack" },
  { name:"Ryu Ryu no Mi: Model Brachiosaurus", type:"Zoan Ancien",    translated:"Fruit du Ryū : Brachiosaure",     description:"Transforme le porteur en brachiosaure préhistorique colossal, avec une résistance et une force gigantesques.",          holder:"Queen" },
  { name:"Ryu Ryu no Mi: Model Ptéranodon",    type:"Zoan Ancien",    translated:"Fruit du Ryū : Ptéranodon",       description:"Transforme le porteur en ptéranodon préhistorique capable de vol rapide et d'attaques enflammées.",                     holder:"King" },
  // ── ZOAN MYTHIQUE ──
  { name:"Hito Hito no Mi: Model Nika",        type:"Zoan Mythique",  translated:"Fruit du Guerrier Solaire : Nika",description:"Le fruit le plus recherché au monde. Transforme en guerrier légendaire dont le corps élastique réchauffe ses alliés.",  holder:"Monkey D. Luffy" },
  { name:"Tori Tori no Mi: Model Phénix",      type:"Zoan Mythique",  translated:"Fruit de l'Oiseau : Phénix",      description:"Transforme le porteur en phénix mythique capable de soigner ses blessures grâce à ses flammes de renaissance.",         holder:"Marco" },
  { name:"Uo Uo no Mi: Model Ryusui",          type:"Zoan Mythique",  translated:"Fruit du Poisson : Dragon Céleste",description:"Transforme le porteur en dragon céleste mythique de taille gigantesque, maîtrisant les nuages et le feu.",            holder:"Kaido" },
  { name:"Inu Inu no Mi: Model Makami",        type:"Zoan Mythique",  translated:"Fruit du Chien : Makami",         description:"Transforme le porteur en loup divin protecteur de Wano, capable de générer et contrôler la glace.",                      holder:"Yamato" },
  { name:"Hito Hito no Mi: Model Daibutsu",    type:"Zoan Mythique",  translated:"Fruit de l'Humain : Daibutsu",    description:"Transforme le porteur en un immense Bouddha doré capable de projeter de puissantes ondes de choc.",                       holder:"Sengoku" },
];
const MAX_FRU_GUESSES = 10;

// ===== SÉLECTION DU JOUR (seed indépendant par mode) =====
const TARGET_C   = dailyPick(CHARACTERS,   1);   // Classique
const TARGET_W   = dailyPick(WANTED_CHARS, 31);  // Wanted
const TARGET_F   = dailyPick(FLAGS,        97);  // Pavillon
const TARGET_FRU = dailyPick(FRUITS,       71);  // Fruit du Démon
const EMOJI_POOL = CHARACTERS.filter(c => Array.isArray(c.emoji) && c.emoji.length > 0);
const TARGET_EM  = dailyPick(EMOJI_POOL,  137);  // Émoji

// Ordre déterministe des cases du pavillon
const CELL_ORDER = (function () {
  const arr = [...Array(16).keys()];
  let seed = TARGET_F.file.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor(seed / 233280 * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
})();
