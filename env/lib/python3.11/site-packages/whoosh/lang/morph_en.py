"""
Contains the variations() function for expanding an English word into multiple
variations by programatically adding and removing suffixes.

Translated to Python from the ``com.sun.labs.minion.lexmorph.LiteMorph_en``
class of Sun's `Minion search engine <https://minion.dev.java.net/>`_.
"""

import re

from whoosh.compat import xrange, iteritems
# Rule exceptions

exceptions = [
        "a",
        "abandoner abandon abandons abandoned abandoning abandonings abandoners",
        "abdomen abdomens",
        "about",
        "above",
        "acid acids acidic acidity acidities",
        "across",
        "act acts acted acting actor actors",
        "ad ads",
        "add adds added adding addings addition additions adder adders",
        "advertise advertises advertised advertising advertiser advertisers advertisement advertisements advertisings",
        "after",
        "again",
        "against",
        "ago",
        "all",
        "almost",
        "along",
        "already",
        "also",
        "although",
        "alumna alumnae alumnus alumni",
        "always",
        "amen amens",
        "amidships",
        "amid amidst",
        "among amongst",
        "an",
        "analysis analyses",
        "and",
        "another other others",
        "antenna antennas antennae",
        "antitheses antithesis",
        "any",
        "anyone anybody",
        "anything",
        "appendix appendixes appendices",
        "apropos",
        "aquarium aquariums aquaria",
        "argument arguments argue argues argued arguing arguings arguer arguers",
        "arise arises arose arisen ariser arisers arising arisings",
        "around",
        "as",
        "asbestos",
        "at",
        "atlas atlases",
        "auger augers augered augering augerings augerer augerers",
        "augment augments augmented augmenting augmentings augmentation augmentations augmenter augmenters",
        "automata automaton automatons",
        "automation automating automate automates automated automatic",
        "avoirdupois",
        "awake awakes awoke awaked awoken awaker awakers awaking awakings awakening awakenings",
        "away",
        "awful awfully awfulness",
        "axis axes axises",
        "bacillus bacilli",
        "bacterium bacteria",
        "bad worse worst badly badness",
        "bas",
        "bases basis",
        "bases base based basing basings basely baseness basenesses basement basements baseless basic basics",
        "be am are is was were been being",
        "bear bears bore borne bearing bearings bearer bearers",
        "beat beats beaten beating beatings beater beaters",
        "because",
        "become becomes became becoming",
        "beef beefs beeves beefed beefing",
        "beer beers",
        "before",
        "begin begins began begun beginning beginnings beginner beginners",
        "behalf behalves",
        "being beings",
        "bend bends bent bending bendings bender benders",
        "bereave bereaves bereaved bereft bereaving bereavings bereavement bereavements",
        "beside besides",
        "best bests bested besting",
        "bet bets betting bettor bettors",
        "betimes",
        "between",
        "beyond",
        "bid bids bade bidden bidding biddings bidder bidders",
        "bier biers",
        "bind binds bound binding bindings binder binders",
        "bit bits",
        "bite bites bit bitten biting bitings biter biters",
        "blackfoot blackfeet",
        "bleed bleeds bled bleeding bleedings bleeder bleeders",
        "blow blows blew blown blowing blowings blower blowers",
        "bookshelf bookshelves",
        "both",
        "bound bounds bounded bounding boundings bounder bounders boundless",
        "bourgeois bourgeoisie",
        "bra bras",
        "brahman brahmans",
        "break breaks broke broken breaking breakings breaker breakers",
        "breed breeds bred breeding breedings breeder breeders",
        "bring brings brought bringing bringings bringer bringers",
        "build builds built building buildings builder builders",
        "bus buses bused bussed busing bussing busings bussings buser busers busser bussers",
        "buss busses bussed bussing bussings busser bussers",
        "but",
        "buy buys bought buying buyings buyer buyers",
        "by",
        "calf calves calved calving calvings calver calvers",
        "can cans canned canning cannings canner canners",
        "can could cannot",
        "canoes canoe canoed canoeing canoeings canoer canoers",
        "catch catches caught catching catchings catcher catchers",
        "cement cements cemented cementing cementings cementer cementers",
        "cent cents",
        "center centers centered centering centerings centerless",
        "child children childless childish childishly",
        "choose chooses chose chosen choosing choosings chooser choosers",
        "cling clings clung clinging clingings clinger clingers",
        "colloquium colloquia colloquiums",
        "come comes came coming comings comer comers",
        "comment comments commented commenting commentings commenter commenters",
        "compendium compendia compendiums",
        "complement complements complemented complementing complementings complementer complementers complementary",
        "compliment compliments complimented complimenting complimentings complimenter complimenters complimentary",
        "concerto concertos concerti",
        "condiment condiments",
        "corps",
        "cortex cortices cortexes cortical",
        "couscous",
        "creep creeps crept creeping creepings creeper creepers creepy",
        "crisis crises",
        "criterion criteria criterial",
        "cryptanalysis cryptanalyses",
        "curriculum curricula curriculums curricular",
        "datum data",
        "day days daily",
        "deal deals dealt dealing dealings dealer dealers",
        "decrement decrements decremented decrementing decrementings decrementer decrementers decremental",
        "deer deers",
        "demented dementia",
        "desideratum desiderata",
        "diagnosis diagnoses diagnose diagnosed diagnosing diagnostic",
        "dialysis dialyses",
        "dice dices diced dicing dicings dicer dicers",
        "die dice",
        "die dies died dying dyings",
        "dig digs dug digging diggings digger diggers",
        "dive dives diver divers dove dived diving divings",
        "divest divests divester divesters divested divesting divestings divestment divestments",
        "do does did done doing doings doer doers",
        "document documents documented documenting documentings documenter documenters documentation documentations documentary",
        "doe does",
        "dove doves",
        "downstairs",
        "dozen",
        "draw draws drew drawn drawing drawings drawer drawers",
        "drink drinks drank drunk drinking drinkings drinker drinkers",
        "drive drives drove driven driving drivings driver drivers driverless",
        "due dues duly",
        "during",
        "e",
        "each",
        "eager eagerer eagerest eagerly eagerness eagernesses",
        "early earlier earliest",
        "easement easements",
        "eat eats ate eaten eating eatings eater eaters",
        "effluvium effluvia",
        "either",
        "element elements elementary",
        "elf elves elfen",
        "ellipse ellipses elliptic elliptical elliptically",
        "ellipsis ellipses elliptic elliptical elliptically",
        "else",
        "embolus emboli embolic embolism",
        "emolument emoluments",
        "emphasis emphases",
        "employ employs employed employing employer employers employee employees employment employments employable",
        "enough",
        "equilibrium equilibria equilibriums",
        "erratum errata",
        "ever",
        "every",
        "everything",
        "exotic exotically exoticness exotica",
        "experiment experiments experimented experimenting experimentings experimenter experimenters experimentation experimental",
        "extra extras",
        "fall falls fell fallen falling fallings faller fallers",
        "far farther farthest",
        "fee fees feeless",
        "feed feeds fed feeding feedings feeder feeders",
        "feel feels felt feeling feelings feeler feelers",
        "ferment ferments fermented fermenting fermentings fermentation fermentations fermenter fermenters",
        "few fewer fewest",
        "fight fights fought fighting fightings fighter fighters",
        "figment figments",
        "filament filaments",
        "find finds found finding findings finder finders",
        "firmament firmaments",
        "flee flees fled fleeing fleeings",
        "fling flings flung flinging flingings flinger flingers",
        "floe floes",
        "fly flies flew flown flying flyings flier fliers flyer flyers",
        "focus foci focuses focused focusing focusses focussed focussing focuser focal",
        "foment foments fomented fomenting fomentings fomenter fomenters",
        "foot feet",
        "foot foots footed footing footer footers",
        "footing footings footer footers",
        "for",
        "forbid forbids forbade forbidden forbidding forbiddings forbidder forbidders",
        "foresee foresaw foreseen foreseeing foreseeings foreseer foreseers",
        "forest forests forester foresting forestation forestations",
        "forget forgets forgot forgotten forgetting forgettings forgetter forgetters forgetful",
        "forsake forsakes forsook forsaken forsaking forsakings forsaker forsakers",
        "found founds founded founding foundings founder founders",
        "fragment fragments fragmented fragmenting fragmentings fragmentation fragmentations fragmenter fragmenters",
        "free frees freer freest freed freeing freely freeness freenesses",
        "freeze freezes froze frozen freezing freezings freezer freezers",
        "from",
        "full fully fuller fullest",
        "fuller fullers full fulls fulled fulling fullings",
        "fungus fungi funguses fungal",
        "gallows",
        "ganglion ganglia ganglions ganglionic",
        "garment garments",
        "gas gasses gassed gassing gassings gasser gassers",
        "gas gases gasses gaseous gasless",
        "gel gels gelled gelling gellings geller gellers",
        "german germans germanic germany German Germans Germanic Germany",
        "get gets got gotten getting gettings getter getters",
        "give gives gave given giving givings giver givers",
        "gladiolus gladioli gladioluses gladiola gladiolas gladiolae",
        "glans glandes",
        "gluiness gluey glue glues glued gluing gluings gluer gluers",
        "go goes went gone going goings goer goers",
        "godchild godchildren",
        "good better best goodly goodness goodnesses",
        "goods",
        "goose geese",
        "goose gooses goosed goosing goosings gooser goosers",
        "grandchild grandchildren",
        "grind grinds ground grinding grindings grinder grinders",
        "ground grounds grounded grounding groundings grounder grounders groundless",
        "grow grows grew grown growing growings grower growers growth",
        "gum gums gummed gumming gummings gummer gummers",
        "half halves",
        "halve halves halved halving halvings halver halvers",
        "hang hangs hung hanged hanging hangings hanger hangers",
        "have has had having havings haver havers",
        "he him his himself",
        "hear hears heard hearing hearings hearer hearers",
        "here",
        "hide hides hid hidden hiding hidings hider hiders",
        "hippopotamus hippopotami hippopotamuses",
        "hold holds held holding holdings holder holders",
        "honorarium honoraria honorariums",
        "hoof hoofs hooves hoofed hoofing hoofer hoofers",
        "how",
        "hum hums hummed humming hummings hummer hummers",
        "hymen hymens hymenal",
        "hypotheses hypothesis hypothesize hypothesizes hypothesized hypothesizer hypothesizing hypothetical hypothetically",
        "i",
        "if iffy",
        "impediment impediments",
        "implement implements implemented implementing implementings implementation implementations implementer implementers",
        "imply implies implied implying implyings implier impliers",
        "in inner",
        "inclement",
        "increment increments incremented incrementing incrementings incrementer incrementers incremental incrementally",
        "index indexes indexed indexing indexings indexer indexers",
        "index indexes indices indexical indexicals",
        "indoor indoors",
        "instrument instruments instrumented instrumenting instrumentings instrumenter instrumenters instrumentation instrumentations instrumental",
        "integument integumentary",
        "into",
        "it its itself",
            "java",
        "july julys",
        "keep keeps kept keeping keepings keeper keepers",
        "knife knifes knifed knifing knifings knifer knifers",
        "knife knives",
        "know knows knew known knowing knowings knower knowers knowledge",
        "lament laments lamented lamenting lamentings lamentation lamentations lamenter lamenters lamentable lamentably",
        "larva larvae larvas larval",
        "late later latest lately lateness",
        "latter latterly",
        "lay lays laid laying layer layers",
        "layer layers layered layering layerings",
        "lead leads led leading leadings leader leaders leaderless",
        "leaf leafs leafed leafing leafings leafer leafers",
        "leaf leaves leafless",
        "leave leaves left leaving leavings leaver leavers",
        "lend lends lent lending lendings lender lenders",
        "less lesser least",
        "let lets letting lettings",
        "lie lies lay lain lying lier liers",
        "lie lies lied lying liar liars",
        "life lives lifeless",
        "light lights lit lighted lighting lightings lightly lighter lighters lightness lightnesses lightless",
        "likely likelier likeliest",
        "limen limens",
        "lineament lineaments",
        "liniment liniments",
        "live alive living",
        "live lives lived living livings",
        "liver livers",
        "loaf loafs loafed loafing loafings loafer loafers",
        "loaf loaves",
        "logic logics logical logically",
        "lose loses lost losing loser losers loss losses",
        "louse lice",
        "lumen lumens",
        "make makes made making makings maker makers",
        "man mans manned manning mannings",
        "man men",
        "manly manlier manliest manliness manful manfulness manhood",
        "manic manically",
        "manner manners mannered mannerly mannerless mannerful",
        "many",
        "matrix matrices matrixes",
        "may might",
        "maximum maxima maximums maximal maximize maximizes maximized maximizing",
        "mean means meant meaning meanings meaningless meaningful",
        "mean meaner meanest meanly meanness meannesses",
        "median medians medianly medial",
        "medium media mediums",
        "meet meets met meeting meetings",
        "memorandum memoranda memorandums",
        "mere merely",
        "metal metals metallic",
        "might mighty mightily",
        "millenium millennia milleniums millennial",
        "mine mines mined mining minings miner miners",
        "mine my our ours",
        "minimum minima minimums minimal",
        "minus minuses",
        "miscellaneous miscellanea miscellaneously miscellaneousness miscellany",
        "molest molests molested molesting molestings molester molesters",
        "moment moments",
        "monument monuments monumental",
        "more most",
        "mouse mice mouseless",
        "much",
        "multiply multiplies multiplier multipliers multiple multiples multiplying multiplyings multiplication multiplications",
        "mum mums mummed mumming mummings mummer mummers",
        "must musts",
        "neither",
        "nemeses nemesis",
        "neurosis neuroses neurotic neurotics",
        "nomen",
        "none",
        "nos no noes",
        "not",
        "nothing nothings nothingness",
        "now",
        "nowadays",
        "nucleus nuclei nucleuses nuclear",
        "number numbers numbered numbering numberings numberless",
        "nutriment nutriments nutrient nutrients nutrition nutritions",
        "oasis oases",
        "octopus octopi octopuses",
        "of",
        "off",
        "offer offers offered offering offerings offerer offerers offeror offerors",
        "often",
        "oftentimes",
        "ointment ointments",
        "omen omens",
        "on",
        "once",
        "only",
        "ornament ornaments ornamented ornamenting ornamentings ornamentation ornamenter ornamenters ornamental",
        "outdoor outdoors",
        "outlay outlays",
        "outlie outlies outlay outlied outlain outlying outlier outliers",
        "ovum ova",
        "ox oxen",
        "parentheses parenthesis",
        "parliament parliaments parliamentary",
        "passerby passer-by passersby passers-by",
        "past pasts",
        "pay pays paid paying payings payer payers payee payees payment payments",
        "per",
        "perhaps",
        "person persons people",
        "phenomenon phenomena phenomenal",
        "pi",
        "picnic picnics picnicker picnickers picnicked picnicking picnickings",
        "pigment pigments pigmented pigmenting pigmentings pigmenter pigmenters pigmentation pigmentations",
        "please pleases pleased pleasing pleasings pleaser pleasers pleasure pleasures pleasuring pleasurings pleasant pleasantly pleasureless pleasureful",
        "plus pluses plusses",
        "polyhedra polyhedron polyhedral",
        "priest priests priestly priestlier priestliest priestliness priestless",
        "prognosis prognoses",
        "prostheses prosthesis",
        "prove proves proved proving provings proofs proof prover provers provable",
        "psychosis psychoses psychotic psychotics",
        "qed",
        "quiz quizzes quizzed quizzing quizzings quizzer quizzers",
        "raiment",
        "rather",
        "re",
        "real really",
        "redo redoes redid redone redoing redoings redoer redoers",
        "regiment regiments regimented regimenting regimenter regimenters regimentation regimental",
        "rendezvous",
        "requiz requizzes requizzed requizzing requizzings requizzer requizzers",
        "ride rides rode ridden riding ridings rider riders rideless",
        "ring rings rang rung ringing ringings ringer ringers ringless",
        "rise rises rose risen rising risings riser risers",
        "rose roses",
        "rudiment rudiments rudimentary",
        "rum rums rummed rumming rummings rummer rummers",
        "run runs ran running runnings runner runners",
        "sacrament sacraments sacramental",
        "same sameness",
        "sans",
        "saw saws sawed sawn sawing sawings sawyer sawyers",
        "say says said saying sayings sayer sayers",
        "scarf scarfs scarves scarfless",
        "schema schemata schemas",
        "sediment sediments sedimentary sedimentation sedimentations",
        "see sees saw seen seeing seeings seer seers",
        "seek seeks sought seeking seekings seeker seekers",
        "segment segments segmented segmenting segmentings segmenter segmenters segmentation segmentations",
        "self selves selfless",
        "sell sells sold selling sellings seller sellers",
        "semen",
        "send sends sent sending sendings sender senders",
        "sentiment sentiments sentimental",
        "series",
        "set sets setting settings",
        "several severally",
        "sew sews sewed sewn sewing sewings sewer sewers",
        "sewer sewers sewerless",
        "shake shakes shook shaken shaking shakings shaker shakers",
        "shall should",
        "shaman shamans",
        "shave shaves shaved shaven shaving shavings shaver shavers shaveless",
        "she her hers herself",
        "sheaf sheaves sheafless",
        "sheep",
        "shelf shelves shelved shelfing shelvings shelver shelvers shelfless",
        "shine shines shined shone shining shinings shiner shiners shineless",
        "shoe shoes shoed shod shoeing shoeings shoer shoers shoeless",
        "shoot shoots shot shooting shootings shooter shooters",
        "shot shots",
        "show shows showed shown showing showings shower showers",
        "shower showers showery showerless",
        "shrink shrinks shrank shrunk shrinking shrinkings shrinker shrinkers shrinkable",
        "sideways",
        "simply simple simpler simplest",
        "since",
        "sing sings sang sung singing singings singer singers singable",
        "sink sinks sank sunk sinking sinkings sinker sinkers sinkable",
        "sit sits sat sitting sittings sitter sitters",
        "ski skis skied skiing skiings skier skiers skiless skiable",
        "sky skies",
        "slay slays slew slain slaying slayings slayer slayers",
        "sleep sleeps slept sleeping sleepings sleeper sleepers sleepless",
        "so",
        "some",
        "something",
        "sometime sometimes",
        "soon",
        "spa spas",
        "speak speaks spoke spoken speaking speakings speaker speakers",
        "species specie",
        "spectrum spectra spectrums",
        "speed speeds sped speeded speeding speedings speeder speeders",
        "spend spends spent spending spendings spender spenders spendable",
        "spin spins spun spinning spinnings spinner spinners",
        "spoke spokes",
        "spring springs sprang sprung springing springings springer springers springy springiness",
        "staff staffs staves staffed staffing staffings staffer staffers",
        "stand stands stood standing standings",
        "stasis stases",
        "steal steals stole stolen stealing stealings stealer stealers",
        "stick sticks stuck sticking stickings sticker stickers",
        "stigma stigmata stigmas stigmatize stigmatizes stigmatized stigmatizing",
        "stimulus stimuli",
        "sting stings stung stinging stingings stinger stingers",
        "stink stinks stank stunk stinking stinkings stinker stinkers",
        "stomach stomachs",
        "stratum strata stratums",
        "stride strides strode stridden striding stridings strider striders",
        "string strings strung stringing stringings stringer stringers stringless",
        "strive strives strove striven striving strivings striver strivers",
        "strum strums strummed strumming strummings strummer strummers strummable",
        "such",
        "suffer suffers suffered suffering sufferings sufferer sufferers sufferable",
        "suggest suggests suggested suggesting suggestings suggester suggesters suggestor suggestors suggestive suggestion suggestions suggestible suggestable",
        "sum sums summed summing summings summer summers",
        "summer summers summered summering summerings",
        "supplement supplements supplemented supplementing supplementings supplementation supplementer supplementers supplementary supplemental",
        "supply supplies supplied supplying supplyings supplier suppliers",
        "swear swears swore sworn swearing swearings swearer swearers",
        "sweep sweeps swept sweeping sweepings sweeper sweepers",
        "swell swells swelled swollen swelling swellings",
        "swim swims swam swum swimming swimmings swimmer swimmers swimable",
        "swine",
        "swing swings swung swinging swingings swinger swingers",
        "syllabus syllabi syllabuses",
        "symposium symposia symposiums",
        "synapse synapses",
        "synapsis synapses",
        "synopsis synopses",
        "synthesis syntheses",
        "tableau tableaux tableaus",
        "take takes took taken taking takings taker takers takable",
        "teach teaches taught teaching teachings teacher teachers teachable",
        "tear tears tore torn tearing tearings tearer tearers tearable",
        "tegument teguments",
        "tell tells told telling tellings teller tellers tellable",
        "temperament temperaments temperamental temperamentally",
        "tenement tenements",
        "the",
        "there theres",
        "theses thesis",
        "they them their theirs themselves",
        "thief thieves thieving thievings",
        "think thinks thought thinking thinker thinkers thinkable",
        "this that these those",
        "thought thoughts thougtful thoughtless",
        "throw throws threw thrown throwing throwings thrower throwers throwable",
        "tic tics",
        "tie ties tied tying tyings tier tiers tieable tieless",
        "tier tiers tiered tiering tierings tierer tierers",
        "to",
        "toe toes toed toeing toeings toer toers toeless",
        "together togetherness",
        "too",
        "tooth teeth toothless",
        "topaz topazes",
        "torment torments tormented tormenting tormentings tormenter tormenters tormentable",
        "toward towards",
        "tread treads trod trodden treading treadings treader treaders",
        "tread treads treadless retread retreads",
        "true truly trueness",
        "two twos",
        "u",
        "under",
        "underlay underlays underlaid underlaying underlayings underlayer underlayers",
        "underlie underlies underlay underlain underlying underlier underliers",
        "undo undoes undid undone undoing undoings undoer undoers undoable",
        "unrest unrestful",
        "until",
        "unto",
        "up",
        "upon",
        "upstairs",
        "use uses user users used using useful useless",
        "various variously",
        "vehement vehemently vehemence",
        "versus",
        "very",
        "visit visits visited visiting visitings visitor visitors",
        "vortex vortexes vortices",
        "wake wakes woke waked woken waking wakings waker wakers wakeful wakefulness wakefulnesses wakeable",
        "wear wears wore worn wearing wearings wearer wearers wearable",
        "weather weathers weathered weathering weatherly",
        "weave weaves wove woven weaving weavings weaver weavers weaveable",
        "weep weeps wept weeping weepings weeper weepers",
        "wharf wharfs wharves",
        "where wheres",
        "whereas whereases",
        "whether whethers",
        "while whiles whilst whiled whiling",
        "whiz whizzes whizzed whizzing whizzings whizzer whizzers",
        "who whom whos whose whoses",
        "why whys",
        "wife wives wifeless",
        "will wills willed willing willings willful",
        "will would",
        "win wins won winning winnings winner winners winnable",
        "wind winds wound winding windings winder winders windable",
        "wind winds windy windless",
        "with",
        "within",
        "without",
        "wolf wolves",
        "woman women womanless womanly",
        "wound wounds wounded wounding woundings",
        "write writes wrote written writing writings writer writers writeable",
        "yeses yes",
        "yet yets",
        "you your yours yourself"
        ]

_exdict = {}
for exlist in exceptions:
    for ex in exlist.split(" "):
        _exdict[ex] = exlist

# Programmatic rules

vowels = "aeiouy"
cons = "bcdfghjklmnpqrstvwxyz"

rules = (
         # Words ending in S

         # (e.g., happiness, business)
         (r"[%s].*[%s](iness)" % (vowels, cons), "y,ies,ier,iers,iest,ied,ying,yings,ily,inesses,iment,iments,iless,iful"),
         # (e.g., baseless, shoeless)
         (r"[%s].*(eless)" % vowels, "e,es,er,ers,est,ed,ing,ings,eing,eings,ely,eness,enesses,ement,ements,eness,enesses,eful"),
         # (e.g., gutless, hatless, spotless)
         (r"[%s][%s][bdgklmnprt]?(less)" % (cons, vowels), ",s,&er,&ers,&est,&ed,&ing,&ings,ly,ness,nesses,ment,ments,ful"),
         # (e.g., thoughtless, worthless)
         (r"[%s].*?(less)" % vowels, ",s,er,ers,est,ed,ing,ings,ly,ness,nesses,ment,ments,ful"),
         # (e.g., baseness, toeness)
         (r"[%s].*(eness)" % vowels, "e,es,er,ers,est,ed,ing,ings,eing,eings,ely,enesses,ement,ements,eless,eful"),
         # (e.g., bluntness, grayness)
         (r"[%s].*(ness)" % vowels, ",s,er,ers,est,ed,ing,ings,ly,nesses,ment,ments,less,ful"),
         # (e.g., albatross, kiss)
         (r"[%s]ss" % vowels, "es,er,ers,est,ed,ing,ings,ly,ness,nesses,ment,ments,less,ful"),
         # (e.g., joyous, fractious, gaseous)
         (r"[%s].*(ous)" % vowels, "ly,ness"),
         # (e.g., tries, unties, jollies, beauties)
         (r"(ies)", "y,ie,yer,yers,ier,iers,iest,ied,ying,yings,yness,iness,ieness,ynesses,inesses,ienesses,iment,iement,iments,iements,yless,iless,ieless,yful,iful,ieful"),
         # (e.g., crisis, kinesis)
         (r"[%s].*(sis)" % vowels, "ses,sises,sisness,sisment,sisments,sisless,sisful"),
         # (e.g., bronchitis, bursitis)
         (r"[%s].*(is)" % vowels, "es,ness,ment,ments,less,ful"),
         (r"[%s].*[cs]h(es)" % vowels, ",e,er,ers,est,ed,ing,ings,ly,ely,ness,eness,nesses,enesses,ment,ement,ments,ements,less,eless,ful,eful"),
         # (e.g., tokenizes) // adds British variations
         (r"[%s].*[%s](izes)" % (vowels, cons), "ize,izes,izer,izers,ized,izing,izings,ization,izations,ise,iser,isers,ised,ising,isings,isation,isations"),
         # (e.g., tokenises) // British variant  // ~expertise
         (r"[%s].*[%s](ises)" % (vowels, cons), "ize,izes,izer,izers,ized,izing,izings,ization,izations,ise,iser,isers,ised,ising,isings,isation,isations"),
         # (e.g., aches, arches)
         (r"[%s].*[jsxz](es)" % vowels, ",e,er,ers,est,ed,ing,ings,ly,ely,ness,eness,nesses,enesses,ment,ement,ments,ements,less,eless,ful,eful"),
         # (e.g., judges, abridges)
         (r"[%s].*dg(es)" % vowels, "e,er,ers,est,ed,ing,ings,ely,eness,enesses,ment,ments,ement,ements,eless,eful"),
         # (e.g., trees, races, likes, agrees) covers all other -es words
         (r"e(s)", ",*"),
         # (e.g., segments, bisegments, cosegments)
         (r"segment(s)", ",*"),
         # (e.g., pigments, depigments, repigments)
         (r"pigment(s)", ",*"),
         # (e.g., judgments, abridgments)
         (r"[%s].*dg(ments)" % vowels, "ment,*ments"),
         # (e.g., merriments, embodiments) -iment in turn will generate y and *y (redo y)
         (r"[%s].*[%s]iment(s)" % (vowels, cons), ",*"),
         # (e.g., atonements, entrapments)
         (r"[%s].*ment(s)" % vowels, ",*"),
         # (e.g., viewers, meters, traders, transfers)
         (r"[%s].*er(s)" % vowels, ",*"),
         # (e.g., unflags) polysyllables
         (r"[%s].*[%s][%s][bdglmnprt](s)" % (vowels, cons, vowels), ",*"),
         # (e.g., frogs) monosyllables
         (r"[%s][%s][bdglmnprt](s)" % (vowels, cons), ",*"),
         # (e.g., killings, muggings)
         (r"[%s].*ing(s)" % vowels, ",*"),
         # (e.g., hulls, tolls)
         (r"[%s].*ll(s)" % vowels, ",*"),
         # e.g., boas, polkas, spas) don't generate latin endings
         (r"a(s)", ",er,ers,est,ed,ing,ings,ly,ness,nesses,ment,ments,less,ful"),
         # (e.g., beads, toads)
         (r"[%s].*[%s].*(s)" % (vowels, cons), ",*"),
         # (e.g., boas, zoos)
         (r"[%s].*[%s](s)" % (cons, vowels), ",er,ers,est,ed,ing,ings,ly,ness,nesses,ment,ments,less,ful"),
         # (e.g., ss, sss, ssss) no vowel (vowel case is already handled above)
         (r"ss()", ""),
         # (e.g., cds, lcds, m-16s) no vowel (can be a plural noun, but not verb)
         (r"[%s].*[%s1234567890](s)" % (cons, cons), ""),

         # Words ending in E

         # (e.g., apple, so it doesn't include apply)
         (r"appl(e)", "es,er,ers,est,ed,ing,ings,ely,eness,enesses,ement,ements,eless,eful"),
         # (e.g., supple, so it doesn't include supply)
         (r"suppl(e)", "es,er,ers,est,ed,ing,ings,ely,eness,enesses,ement,ements,eless,eful"),
         # (e.g., able, abominable, fungible, table, enable, idle, subtle)
         (r"[%s].*[%s]l(e)" % (vowels, cons), "es,er,ers,est,ed,ing,ings,y,ely,eness,enesses,ement,ements,eless,eful"),
         # (e.g., bookie, magpie, vie)
         (r"(ie)", "ies,ier,iers,iest,ied,ying,yings,iely,ieness,ienesses,iement,iements,ieless,ieful"),
         # (e.g., dye, redye, redeye)
         (r"ye()", "s,r,rs,st,d,ing,ings,ly,ness,nesses,ment,ments,less,ful"),
         # (e.g., judge, abridge)
         (r"[%s].*dg(e)" % vowels, "es,er,ers,est,ed,ing,ings,ely,eness,enesses,ment,ments,less,ful,ement,ements,eless,eful"),
         # (e.g., true, due, imbue)
         (r"u(e)", "es,er,ers,est,ed,ing,ings,eing,eings,ly,ely,eness,enesses,ment,ments,less,ful,ement,ements,eless,eful"),
         # (e.g., tokenize) // adds British variations
         (r"[%s].*[%s](ize)" % (vowels, cons), "izes,izer,izers,ized,izing,izings,ization,izations,ise,ises,iser,isers,ised,ising,isings,isation,isations"),
         # (e.g., tokenise) // British variant  // ~expertise
         (r"[%s].*[%s](ise)" % (vowels, cons), "ize,izes,izer,izers,ized,izing,izings,ization,izations,ises,iser,isers,ised,ising,isings,isation,isations"),
         # (e.g., tree, agree, rage, horse, hoarse)
         (r"[%s].*[%s](e)" % (vowels, cons), "es,er,ers,est,ed,ing,ings,eing,eings,ely,eness,enesses,ement,ements,eless,eful"),

         # Words ending in -ED

         # (e.g., agreed, freed, decreed, treed)
         (r"ree(d)", "ds,der,ders,ded,ding,dings,dly,dness,dnesses,dment,dments,dless,dful,,*"),
         # (e.g., feed, seed, Xweed)
         (r"ee(d)", "ds,der,ders,ded,ding,dings,dly,dness,dnesses,dment,dments,dless,dful"),
         # (e.g., tried)
         (r"[%s](ied)" % cons, "y,ie,ies,ier,iers,iest,ying,yings,ily,yly,iness,yness,inesses,ynesses,iment,iments,iless,iful,yment,yments,yless,yful"),
         # (e.g., controlled, fulfilled, rebelled)
         (r"[%s].*[%s].*l(led)" % (vowels, cons), ",s,er,ers,est,ing,ings,ly,ness,nesses,ment,ments,less,ful,&,&s,&er,&ers,&est,&ing,&ings,&y,&ness,&nesses,&ment,&ments,&ful"),
         # (e.g., pulled, filled, fulled)
         (r"[%s].*l(led)" % vowels, "&,&s,&er,&ers,&est,&ing,&ings,&y,&ness,&nesses,&ment,&ments,&ful"),
         # (e.g., hissed, grossed)
         (r"[%s].*s(sed)" % vowels, "&,&es,&er,&ers,&est,&ing,&ings,&ly,&ness,&nesses,&ment,&ments,&less,&ful"),
         # (e.g., hugged, trekked)
         (r"[%s][%s](?P<ed1>[bdgklmnprt])((?P=ed1)ed)", ",s,&er,&ers,&est,&ing,&ings,ly,ness,nesses,ment,ments,less,ful"),
         # (e.g., tokenize) // adds British variations
         (r"[%s].*[%s](ized)" % (vowels, cons), "izes,izer,izers,ize,izing,izings,ization,izations,ise,ises,iser,isers,ised,ising,isings,isation,isations"),
         # (e.g., tokenise) // British variant  // ~expertise
         (r"[%s].*[%s](ized)" % (vowels, cons), "ize,izes,izer,izers,ized,izing,izings,ization,izations,ises,iser,isers,ise,ising,isings,isation,isations"),
         # (e.g., spoiled, tooled, tracked, roasted, atoned, abridged)
         (r"[%s].*(ed)" % vowels, ",e,s,es,er,ers,est,ing,ings,ly,ely,ness,eness,nesses,enesses,ment,ement,ments,ements,less,eless,ful,eful"),
         # (e.g., bed, sled) words with a single e as the only vowel
         (r"ed()", "s,&er,&ers,&est,&ed,&ing,&ings,ly,ness,nesses,ment,ments,less,ful"),

         # Words ending in -ER

         # (e.g., altimeter, ammeter, odometer, perimeter)
         (r"meter()", "s,er,ers,ed,ing,ings,ly,ness,nesses,ment,ments,less,ful"),
         # (e.g., agreer, beer, budgeteer, engineer, freer)
         (r"eer()", "eers,eered,eering,eerings,eerly,eerness,eernesses,eerment,eerments,eerless,eerful,ee,ees,eest,eed,eeing,eeings,eely,eeness,eenesses,eement,eements,eeless,eeful,eerer,eerers,eerest"),
         # (e.g., acidifier, saltier)
         (r"[%s].*[%s](ier)" % (vowels, cons), "y,ie,ies,iest,ied,ying,yings,ily,yly,iness,yness,inesses,ynesses,yment,yments,yless,yful,iment,iments,iless,iful,iers,iered,iering,ierings,ierly,ierness,iernesses,ierment,ierments,ierless,ierful,ierer,ierers,ierest"),
         # (e.g., puller, filler, fuller)
         (r"[%s].*l(ler)" % vowels, "&,&s,&est,&ed,&ing,&ings,ly,lely,&ness,&nesses,&ment,&ments,&ful,&ers,&ered,&ering,&erings,&erly,&erness,&ernesses,&erments,&erless,&erful"),
         # (e.g., hisser, grosser)
         (r"[%s].*s(ser)" % vowels, "&,&es,&est,&ed,&ing,&ings,&ly,&ness,&nesses,&ment,&ments,&less,&ful,&ers,&ered,&ering,&erings,&erly,&erness,&ernesses,&erment,&erments,&erless,&erful"),
         # (e.g., bigger, trekker, hitter)
         (r"[%s][%s](?P<er1>[bdgkmnprt])((?P=er1)er)" % (cons, vowels), "s,&est,&ed,&ing,&ings,ly,ness,nesses,ment,ments,less,ful,&ers,&ered,&ering,&erings,&erly,&erness,&ernesses,&erments,&erless,&erful"),
         # (e.g., tokenize) // adds British variations
         (r"[%s].*[%s](izer)" % (vowels, cons), "izes,ize,izers,ized,izing,izings,ization,izations,ise,ises,iser,isers,ised,ising,isings,isation,isations"),
         # (e.g., tokenise) // British variant  // ~expertise
         (r"[%s].*[%s](iser)" % (vowels, cons), "ize,izes,izer,izers,ized,izing,izings,ization,izations,ises,ise,isers,ised,ising,isings,isation,isations"),
         #(e.g., actioner, atoner, icer, trader, accruer, churchgoer, prefer)
         (r"[%s].*(er)" % vowels, ",e,s,es,est,ed,ing,ings,ly,ely,ness,eness,nesses,enesses,ment,ments,less,ful,ement,ements,eless,eful,ers,ered,erred,ering,erring,erings,errings,erly,erness,ernesses,erment,erments,erless,erful,erer,erers,erest,errer,errers,errest"),

         # Words ending in -EST

         # (e.g., sliest, happiest, wittiest)
         (r"[%s](iest)" % cons, "y,ies,ier,iers,ied,ying,yings,ily,yly,iness,yness,inesses,ynesses,iment,iments,iless,iful"),
         # (e.g., fullest)
         (r"[%s].*l(lest)" % vowels, "&,&s,&er,&ers,&ed,&ing,&ings,ly,&ness,&nesses,&ment,&ments,&ful"),
         # (e.g.,  grossest)
         (r"[%s].*s(sest)" % vowels, "&,&es,&er,&ers,&ed,&ing,&ings,&ly,&ness,&nesses,&ment,&ments,&less,&ful"),
         # (e.g., biggest)
         (r"[%s][%s](?P<est1>[bdglmnprst])((?P=est1)est)" % (cons, vowels), ",s,&er,&ers,&ed,&ing,&ings,ly,ness,nesses,ment,ments,less,ful"),
         # (e.g., basest, archest, rashest)
         (r"[%s].*([cs]h|[jsxz])(est)" % vowels, "e,es,er,ers,ed,ing,ings,ly,ely,ness,eness,nesses,enesses,ment,ments,less,ful,ement,ements,eless,eful,ests,ester,esters,ested,esting,estings,estly,estness,estnesses,estment,estments,estless,estful"),
         # (e.g., severest, Xinterest, merest)
         (r"er(est)", "e,es,er,ers,ed,eing,eings,ely,eness,enesses,ement,ements,eless,eful,ests,ester,esters,ested,esting,estings,estly,estness,estnesses,estment,estments,estless,estful"),
         # (e.g., slickest, coolest, ablest, amplest, protest, quest)
         (r"[%s].*(est)" % vowels, ",e,s,es,er,ers,ed,ing,ings,ly,ely,ness,eness,nesses,enesses,ment,ments,less,ful,ement,ements,eless,eful,ests,ester,esters,ested,esting,estings,estly,estness,estnesses,estment,estments,estless,estful"),
         # (e.g., rest, test)
         (r"est", "s,er,ers,ed,ing,ings,ly,ness,nesses,ment,ments,less,ful"),

         # Words ending in -FUL

         # (e.g., beautiful, plentiful)
         (r"[%s].*[%s](iful)" % (vowels, cons), "ifully,ifulness,*y"),
         # (e.g., hopeful, sorrowful)
         (r"[%s].*(ful)" % vowels, "fully,fulness,,*"),

         # Words ending in -ICAL

         (r"[%s].*(ical)" % vowels, "ic,ics,ically"),

         # Words ending in -IC

         (r"[%s].*(ic)" % vowels, "ics,ical,ically"),

         # Words ending in -ING

         # (e.g., dying, crying, supplying)
         (r"[%s](ying)" % cons, "yings,ie,y,ies,ier,iers,iest,ied,iely,yly,ieness,yness,ienesses,ynesses,iment,iments,iless,iful"),
         # (e.g., pulling, filling, fulling)
         (r"[%s].*l(ling)" % vowels, ",*,&,&s,&er,&ers,&est,&ed,&ings,&ness,&nesses,&ment,&ments,&ful"),
         # (e.g., hissing, grossing, processing)
         (r"[%s].*s(sing)" % vowels, "&,&s,&er,&ers,&est,&ed,&ings,&ly,&ness,&nesses,&ment,&ments,&less,&ful"),
         # (e.g., hugging, trekking)
         (r"[%s][%s](?P<ing1>[bdgklmnprt])((?P=ing1)ing)" % (cons, vowels), ",s,&er,&ers,&est,&ed,&ings,ly,ness,nesses,ment,ments,less,ful"),
         # (e.g., freeing, agreeing)
         (r"eeing()", "ee,ees,eer,eers,eest,eed,eeings,eely,eeness,eenesses,eement,eements,eeless,eeful"),
         # (e.g., ageing, aweing)
         (r"[%s].*(eing)" % vowels, "e,es,er,ers,est,ed,eings,ely,eness,enesses,ement,ements,eless,eful"),
         # (e.g., toying, playing)
         (r"[%s].*y(ing)" % vowels, ",s,er,ers,est,ed,ings,ly,ingly,ness,nesses,ment,ments,less,ful"),
         # (e.g., editing, crediting, expediting, siting, exciting)
         (r"[%s].*[%s][eio]t(ing)" % (vowels, cons), ",*,*e,ings,inger,ingers,ingest,inged,inging,ingings,ingly,ingness,ingnesses,ingment,ingments,ingless,ingful"),
         # (e.g., robing, siding, doling, translating, flaking)
         (r"[%s][%s][bdgklmt](ing)" % (cons, vowels), "*e,ings,inger,ingers,ingest,inged,ingly,ingness,ingnesses,ingment,ingments,ingless,ingful"),
         # (e.g., tokenize) // adds British variations
         (r"[%s].*[%s](izing)" % (vowels, cons), "izes,izer,izers,ized,ize,izings,ization,izations,ise,ises,iser,isers,ised,ising,isings,isation,isations"),
         # (e.g., tokenise) // British variant  // ~expertise
         (r"[%s].*[%s](ising)" % (vowels, cons), "ize,izes,izer,izers,ized,izing,izings,ization,izations,ises,iser,isers,ised,ise,isings,isation,isations"),
         # (e.g., icing, aging, achieving, amazing, housing)
         (r"[%s][cgsvz](ing)" % vowels, "*e,ings,inger,ingers,ingest,inged,inging,ingings,ingly,ingness,ingnesses,ingment,ingments,ingless,ingful"),
         # (e.g., dancing, troubling, arguing, bluing, carving)
         (r"[%s][clsuv](ing)" % cons, "*e,ings,inger,ingers,ingest,inged,inging,ingings,ingly,ingness,ingnesses,ingment,ingments,ingless,ingful"),
         # (e.g., charging, bulging)
         (r"[%s].*[lr]g(ing)" % vowels, "*e,ings,inger,ingers,ingest,inged,inging,ingings,ingly,ingness,ingnesses,ingment,ingments,ingless,ingful"),
         # (e.g., farming, harping, interesting, bedspring, redwing)
         (r"[%s].*[%s][bdfjkmnpqrtwxz](ing)" % (vowels, cons), ",*,ings,inger,ingers,ingest,inged,inging,ingings,ingly,ingness,ingnesses,ingment,ingments,ingless,ingful"),
         # (e.g., spoiling, reviling, autoing, egging, hanging, hingeing)
         (r"[%s].*(ing)" % vowels, ",*,*e,ings,inger,ingers,ingest,inged,inging,ingings,ingly,ingness,ingnesses,ingment,ingments,ingless,ingful"),
         # (e.g., wing, thing) monosyllables
         (r"(ing)", "ings,inger,ingers,ingest,inged,inging,ingings,ingly,ingness,ingnesses,ingment,ingments,ingless,ingful"),

         # -LEAF rules omitted

         # Words ending in -MAN
         # (e.g., policewomen, hatchetmen, dolmen)
         (r"(man)", "man,mens,mener,meners,menest,mened,mening,menings,menly,menness,mennesses,menless,menful"),

         # Words ending in -MENT

         # (e.g., segment, bisegment, cosegment, pigment, depigment, repigment)
         (r"segment|pigment", "s,ed,ing,ings,er,ers,ly,ness,nesses,less,ful"),
         # (e.g., judgment, abridgment)
         (r"[%s].*dg(ment)" % vowels, "*e"),
         # (e.g., merriment, embodiment)
         (r"[%s].*[%s](iment)" % (vowels, cons), "*y"),
         # (e.g., atonement, entrapment)
         (r"[%s].*[%s](ment)" % (vowels, cons), ",*"),

         # Words ending in -O

         # (e.g., taboo, rodeo)
         (r"[%s]o()" % vowels, "s,er,ers,est,ed,ing,ings,ly,ness,nesses,ment,ments,less,ful"),
         # (e.g., tomato, bonito)
         (r"[%s].*o()" % vowels, "s,es,er,ers,est,ed,ing,ings,ly,ness,nesses,ment,ments,less,ful"),

         # Words ending in -UM

         # (e.g., datum, quantum, tedium, strum, [oil]drum, vacuum)
         (r"[%s].*(um)" % vowels, "a,ums,umer,ummer,umers,ummers,umed,ummed,uming,umming,umings,ummings,umness,umments,umless,umful"),

         # Words ending in -Y

         # (e.g., ably, horribly, wobbly)
         (r"[%s].*b(ly)" % vowels, "le,les,ler,lers,lest,led,ling,lings,leness,lenesses,lement,lements,leless,leful"),
         # (e.g., happily, dizzily)
         (r"[%s].*[%s](ily)" % (vowels, cons), "y,ies,ier,iers,iest,ied,ying,yings,yness,iness,ynesses,inesses,iment,iments,iless,iful"),
         # (e.g., peaceful+ly)
         (r"[%s].*ful(ly)" % vowels, ",*"),
         # (e.g., fully, folly, coolly, fatally, dally)
         (r"[%s].*l(ly)" % vowels, ",*,lies,lier,liers,liest,lied,lying,lyings,liness,linesses,liment,liments,liless,liful,*l"),
         # (e.g., monopoly, Xcephaly, holy)
         (r"[%s](ly)" % vowels, "lies,lier,liers,liest,lied,lying,lyings,liness,linesses,liment,liments,liless,liful"),
         # (e.g., frequently, comely, deeply, apply, badly)
         (r"[%s].*(ly)" % vowels, ",*,lies,lier,liers,liest,lied,lying,lyings,liness,linesses,lyless,lyful"),
         # (e.g., happy, ply, spy, cry)
         (r"[%s](y)" % cons, "ies,ier,iers,iest,ied,ying,yings,ily,yness,iness,ynesses,inesses,iment,iments,iless,iful,yment,yments,yless,yful"),
         # (e.g., betray, gay, stay)
         (r"[%s]y()" % vowels, "s,er,ers,est,ed,ing,ings,ly,ness,nesses,ment,ments,less,ful"),

         # Root rules

         # (e.g., fix, arch, rash)
         (r"[%s].*(ch|sh|[jxz])()" % vowels, "es,er,ers,est,ed,ing,ings,ly,ness,nesses,ment,ments,less,ful"),
         # (e.g., unflag, open, besot)
         (r"[%s].*[%s][%s][bdglmnprt]()" % (vowels, cons, vowels), "s,er,ers,est,ed,ing,ings,&er,&ers,&est,&ed,&ing,&ings,ly,ness,nesses,ment,ments,less,ful"),
         # (e.g., bed, cop)
         (r"[%s][%s][bdglmnprt]()" % (cons, vowels), "s,&er,&ers,&est,&ed,&ing,&ings,ly,ness,nesses,ment,ments,less,ful"),
         # (e.g., schemata, automata)
         (r"[%s].*[%s][%s]ma(ta)" % (vowels, cons, vowels), ",s,tas,tum,tums,ton,tons,tic,tical"),
         # (e.g., chordata, data, errata, sonata, toccata)
         (r"[%s].*t(a)" % vowels, "as,ae,um,ums,on,ons,ic,ical"),
         # (e.g., polka, spa, schema, ova, polyhedra)
         (r"[%s].*[%s](a)" % (vowels, cons), "as,aed,aing,ae,ata,um,ums,on,ons,al,atic,atical"),
         # (e.g., full)
         (r"[%s].*ll()" % vowels, "s,er,ers,est,ed,ing,ings,y,ness,nesses,ment,ments,-less,ful"),
         # (e.g., spoon, rhythm)
         (r"[%s].*()", "s,er,ers,est,ed,ing,ings,ly,ness,nesses,ment,ments,less,ful"),
         )

# There are a limited number of named groups available in a single
# regular expression, so we'll partition the list of rules into
# smaller chunks.

_partition_size = 20
_partitions = []
for p in xrange(0, len(rules) // _partition_size + 1):
    start = p * _partition_size
    end = (p + 1) * _partition_size
    pattern = "|".join("(?P<_g%s>%s)$" % (i, r[0])
                       for i, r in enumerate(rules[start:end]))
    _partitions.append(re.compile(pattern))


def variations(word):
    """Given an English word, returns a collection of morphological variations
    on the word by algorithmically adding and removing suffixes. The variation
    list may contain non-words (e.g. render -> renderment).

    >>> variations("pull")
    set(['pull', 'pullings', 'pullnesses', 'pullful', 'pullment', 'puller', ... ])
    """

    if word in _exdict:
        return _exdict[word].split(" ")

    for i, p in enumerate(_partitions):
        match = p.search(word)
        if match:
            # Get the named group that matched
            num = int([k for k, v in iteritems(match.groupdict())
                       if v is not None and k.startswith("_g")][0][2:])
            # Get the positional groups for the matched group (all other
            # positional groups are None)
            groups = [g for g in match.groups() if g is not None]
            ending = groups[-1]
            root = word[:0 - len(ending)] if ending else word

            out = set((word,))
            results = rules[i * _partition_size + num][1]
            for result in results.split(","):
                if result.startswith("&"):
                    out.add(root + root[-1] + result[1:])
                elif result.startswith("*"):
                    out.union(variations(root + result[1:]))
                else:
                    out.add(root + result)
            return set(out)

    return [word]
