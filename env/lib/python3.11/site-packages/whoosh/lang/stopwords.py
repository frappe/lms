# coding=utf-8

from __future__ import unicode_literals

# Stopwords Corpus
#
# This module contains lists of stop words for several languages.  These
# are high-frequency grammatical words which are usually ignored in text
# retrieval applications.
#
# They were obtained from:
# anoncvs.postgresql.org/cvsweb.cgi/pgsql/src/backend/snowball/stopwords/


# =====
# This module was generated from the original files using the following script

#import os.path
#import textwrap
#
#names = os.listdir("stopwords")
#for name in names:
#    f = open("stopwords/" + name)
#    wordls = [line.strip() for line in f]
#    words = " ".join(wordls)
#    print '"%s": frozenset(u"""' % name
#    print textwrap.fill(words, 72)
#    print '""".split())'
#    print


stoplists = {
    "da": frozenset("""
    og i jeg det at en den til er som på de med han af for ikke der var mig
    sig men et har om vi min havde ham hun nu over da fra du ud sin dem os
    op man hans hvor eller hvad skal selv her alle vil blev kunne ind når
    være dog noget ville jo deres efter ned skulle denne end dette mit
    også under have dig anden hende mine alt meget sit sine vor mod disse
    hvis din nogle hos blive mange ad bliver hendes været thi jer sådan
    """.split()),

    "nl": frozenset("""
    de en van ik te dat die in een hij het niet zijn is was op aan met als
    voor had er maar om hem dan zou of wat mijn men dit zo door over ze zich
    bij ook tot je mij uit der daar haar naar heb hoe heeft hebben deze u
    want nog zal me zij nu ge geen omdat iets worden toch al waren veel meer
    doen toen moet ben zonder kan hun dus alles onder ja eens hier wie werd
    altijd doch wordt wezen kunnen ons zelf tegen na reeds wil kon niets uw
    iemand geweest andere
    """.split()),

    "en": frozenset("""
    i me my myself we our ours ourselves you your yours yourself yourselves
    he him his himself she her hers herself it its itself they them their
    theirs themselves what which who whom this that these those am is are
    was were be been being have has had having do does did doing a an the
    and but if or because as until while of at by for with about against
    between into through during before after above below to from up down in
    out on off over under again further then once here there when where why
    how all any both each few more most other some such no nor not only own
    same so than too very s t can will just don should now
    """.split()),

    "fi": frozenset("""
    olla olen olet on olemme olette ovat ole oli olisi olisit olisin
    olisimme olisitte olisivat olit olin olimme olitte olivat ollut olleet
    en et ei emme ette eivät minä minun minut minua minussa minusta minuun
    minulla minulta minulle sinä sinun sinut sinua sinussa sinusta sinuun
    sinulla sinulta sinulle hän hänen hänet häntä hänessä hänestä
    häneen hänellä häneltä hänelle me meidän meidät meitä meissä
    meistä meihin meillä meiltä meille te teidän teidät teitä teissä
    teistä teihin teillä teiltä teille he heidän heidät heitä heissä
    heistä heihin heillä heiltä heille tämä tämän tätä tässä
    tästä tähän tallä tältä tälle tänä täksi tuo tuon tuotä
    tuossa tuosta tuohon tuolla tuolta tuolle tuona tuoksi se sen sitä
    siinä siitä siihen sillä siltä sille sinä siksi nämä näiden
    näitä näissä näistä näihin näillä näiltä näille näinä
    näiksi nuo noiden noita noissa noista noihin noilla noilta noille noina
    noiksi ne niiden niitä niissä niistä niihin niillä niiltä niille
    niinä niiksi kuka kenen kenet ketä kenessä kenestä keneen kenellä
    keneltä kenelle kenenä keneksi ketkä keiden ketkä keitä keissä
    keistä keihin keillä keiltä keille keinä keiksi mikä minkä minkä
    mitä missä mistä mihin millä miltä mille minä miksi mitkä joka
    jonka jota jossa josta johon jolla jolta jolle jona joksi jotka joiden
    joita joissa joista joihin joilla joilta joille joina joiksi että ja
    jos koska kuin mutta niin sekä sillä tai vaan vai vaikka kanssa mukaan
    noin poikki yli kun niin nyt itse
    """.split()),

    "fr": frozenset("""
    au aux avec ce ces dans de des du elle en et eux il je la le leur lui ma
    mais me même mes moi mon ne nos notre nous on ou par pas pour qu que
    qui sa se ses son sur ta te tes toi ton tu un une vos votre vous c d j l
    à m n s t y été étée étées étés étant étante étants étantes
    suis es est sommes êtes sont serai seras sera serons serez seront
    serais serait serions seriez seraient étais était étions étiez
    étaient fus fut fûmes fûtes furent sois soit soyons soyez soient
    fusse fusses fût fussions fussiez fussent ayant ayante ayantes ayants
    eu eue eues eus ai as avons avez ont aurai auras aura aurons aurez
    auront aurais aurait aurions auriez auraient avais avait avions aviez
    avaient eut eûmes eûtes eurent aie aies ait ayons ayez aient eusse
    eusses eût eussions eussiez eussent
    """.split()),

    "de": frozenset("""
    aber alle allem allen aller alles als also am an ander andere anderem
    anderen anderer anderes anderm andern anderr anders auch auf aus bei bin
    bis bist da damit dann der den des dem die das daß derselbe derselben
    denselben desselben demselben dieselbe dieselben dasselbe dazu dein
    deine deinem deinen deiner deines denn derer dessen dich dir du dies
    diese diesem diesen dieser dieses doch dort durch ein eine einem einen
    einer eines einig einige einigem einigen einiger einiges einmal er ihn
    ihm es etwas euer eure eurem euren eurer eures für gegen gewesen hab
    habe haben hat hatte hatten hier hin hinter ich mich mir ihr ihre ihrem
    ihren ihrer ihres euch im in indem ins ist jede jedem jeden jeder jedes
    jene jenem jenen jener jenes jetzt kann kein keine keinem keinen keiner
    keines können könnte machen man manche manchem manchen mancher manches
    mein meine meinem meinen meiner meines mit muss musste nach nicht nichts
    noch nun nur ob oder ohne sehr sein seine seinem seinen seiner seines
    selbst sich sie ihnen sind so solche solchem solchen solcher solches
    soll sollte sondern sonst über um und uns unse unsem unsen unser unses
    unter viel vom von vor während war waren warst was weg weil weiter
    welche welchem welchen welcher welches wenn werde werden wie wieder will
    wir wird wirst wo wollen wollte würde würden zu zum zur zwar zwischen
    """.split()),

    "hu": frozenset("""
    a ahogy ahol aki akik akkor alatt által általában amely amelyek
    amelyekben amelyeket amelyet amelynek ami amit amolyan amíg amikor át
    abban ahhoz annak arra arról az azok azon azt azzal azért aztán
    azután azonban bár be belül benne cikk cikkek cikkeket csak de e
    eddig egész egy egyes egyetlen egyéb egyik egyre ekkor el elég ellen
    elõ elõször elõtt elsõ én éppen ebben ehhez emilyen ennek erre ez
    ezt ezek ezen ezzel ezért és fel felé hanem hiszen hogy hogyan igen
    így illetve ill. ill ilyen ilyenkor ison ismét itt jó jól jobban
    kell kellett keresztül keressünk ki kívül között közül legalább
    lehet lehetett legyen lenne lenni lesz lett maga magát majd majd már
    más másik meg még mellett mert mely melyek mi mit míg miért milyen
    mikor minden mindent mindenki mindig mint mintha mivel most nagy nagyobb
    nagyon ne néha nekem neki nem néhány nélkül nincs olyan ott össze
    õ õk õket pedig persze rá s saját sem semmi sok sokat sokkal
    számára szemben szerint szinte talán tehát teljes tovább továbbá
    több úgy ugyanis új újabb újra után utána utolsó vagy vagyis
    valaki valami valamint való vagyok van vannak volt voltam voltak
    voltunk vissza vele viszont volna
    """.split()),

    "it": frozenset("""
    ad al allo ai agli all agl alla alle con col coi da dal dallo dai dagli
    dall dagl dalla dalle di del dello dei degli dell degl della delle in
    nel nello nei negli nell negl nella nelle su sul sullo sui sugli sull
    sugl sulla sulle per tra contro io tu lui lei noi voi loro mio mia miei
    mie tuo tua tuoi tue suo sua suoi sue nostro nostra nostri nostre vostro
    vostra vostri vostre mi ti ci vi lo la li le gli ne il un uno una ma ed
    se perché anche come dov dove che chi cui non più quale quanto quanti
    quanta quante quello quelli quella quelle questo questi questa queste si
    tutto tutti a c e i l o ho hai ha abbiamo avete hanno abbia abbiate
    abbiano avrò avrai avrà avremo avrete avranno avrei avresti avrebbe
    avremmo avreste avrebbero avevo avevi aveva avevamo avevate avevano ebbi
    avesti ebbe avemmo aveste ebbero avessi avesse avessimo avessero avendo
    avuto avuta avuti avute sono sei è siamo siete sia siate siano sarò
    sarai sarà saremo sarete saranno sarei saresti sarebbe saremmo sareste
    sarebbero ero eri era eravamo eravate erano fui fosti fu fummo foste
    furono fossi fosse fossimo fossero essendo faccio fai facciamo fanno
    faccia facciate facciano farò farai farà faremo farete faranno farei
    faresti farebbe faremmo fareste farebbero facevo facevi faceva facevamo
    facevate facevano feci facesti fece facemmo faceste fecero facessi
    facesse facessimo facessero facendo sto stai sta stiamo stanno stia
    stiate stiano starò starai starà staremo starete staranno starei
    staresti starebbe staremmo stareste starebbero stavo stavi stava stavamo
    stavate stavano stetti stesti stette stemmo steste stettero stessi
    stesse stessimo stessero stando
    """.split()),

    "no": frozenset("""
    og i jeg det at en et den til er som på de med han av ikke ikkje der
    så var meg seg men ett har om vi min mitt ha hadde hun nå over da ved
    fra du ut sin dem oss opp man kan hans hvor eller hva skal selv sjøl
    her alle vil bli ble blei blitt kunne inn når være kom noen noe ville
    dere som deres kun ja etter ned skulle denne for deg si sine sitt mot å
    meget hvorfor dette disse uten hvordan ingen din ditt blir samme hvilken
    hvilke sånn inni mellom vår hver hvem vors hvis både bare enn fordi
    før mange også slik vært være båe begge siden dykk dykkar dei deira
    deires deim di då eg ein eit eitt elles honom hjå ho hoe henne hennar
    hennes hoss hossen ikkje ingi inkje korleis korso kva kvar kvarhelst
    kven kvi kvifor me medan mi mine mykje no nokon noka nokor noko nokre si
    sia sidan so somt somme um upp vere vore verte vort varte vart
    """.split()),

    "pt": frozenset("""
    de a o que e do da em um para com não uma os no se na por mais as dos
    como mas ao ele das à seu sua ou quando muito nos já eu também só
    pelo pela até isso ela entre depois sem mesmo aos seus quem nas me esse
    eles você essa num nem suas meu às minha numa pelos elas qual nós lhe
    deles essas esses pelas este dele tu te vocês vos lhes meus minhas teu
    tua teus tuas nosso nossa nossos nossas dela delas esta estes estas
    aquele aquela aqueles aquelas isto aquilo estou está estamos estão
    estive esteve estivemos estiveram estava estávamos estavam estivera
    estivéramos esteja estejamos estejam estivesse estivéssemos estivessem
    estiver estivermos estiverem hei há havemos hão houve houvemos
    houveram houvera houvéramos haja hajamos hajam houvesse houvéssemos
    houvessem houver houvermos houverem houverei houverá houveremos
    houverão houveria houveríamos houveriam sou somos são era éramos
    eram fui foi fomos foram fora fôramos seja sejamos sejam fosse
    fôssemos fossem for formos forem serei será seremos serão seria
    seríamos seriam tenho tem temos tém tinha tínhamos tinham tive teve
    tivemos tiveram tivera tivéramos tenha tenhamos tenham tivesse
    tivéssemos tivessem tiver tivermos tiverem terei terá teremos terão
    teria teríamos teriam
    """.split()),

    "ru": frozenset("""
    и в во не что он на я с со как а то все она
    так его но да ты к у же вы за бы по только
    ее мне было вот от меня еще нет о из ему
    теперь когда даже ну вдруг ли если уже
    или ни быть был него до вас нибудь опять
    уж вам ведь там потом себя ничего ей
    может они тут где есть надо ней для мы
    тебя их чем была сам чтоб без будто чего
    раз тоже себе под будет ж тогда кто этот
    того потому этого какой совсем ним
    здесь этом один почти мой тем чтобы нее
    сейчас были куда зачем всех никогда
    можно при наконец два об другой хоть
    после над больше тот через эти нас про
    всего них какая много разве три эту моя
    впрочем хорошо свою этой перед иногда
    лучше чуть том нельзя такой им более
    всегда конечно всю между
    """.split()),

    "es": frozenset("""
    de la que el en y a los del se las por un para con no una su al lo como
    más pero sus le ya o este sí porque esta entre cuando muy sin sobre
    también me hasta hay donde quien desde todo nos durante todos uno les
    ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo
    otro otras otra él tanto esa estos mucho quienes nada muchos cual poco
    ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas
    nosotras vosostros vosostras os mío mía míos mías tuyo tuya tuyos
    tuyas suyo suya suyos suyas nuestro nuestra nuestros nuestras vuestro
    vuestra vuestros vuestras esos esas estoy estás está estamos estáis
    están esté estés estemos estéis estén estaré estarás estará
    estaremos estaréis estarán estaría estarías estaríamos estaríais
    estarían estaba estabas estábamos estabais estaban estuve estuviste
    estuvo estuvimos estuvisteis estuvieron estuviera estuvieras
    estuviéramos estuvierais estuvieran estuviese estuvieses estuviésemos
    estuvieseis estuviesen estando estado estada estados estadas estad he
    has ha hemos habéis han haya hayas hayamos hayáis hayan habré habrás
    habrá habremos habréis habrán habría habrías habríamos habríais
    habrían había habías habíamos habíais habían hube hubiste hubo
    hubimos hubisteis hubieron hubiera hubieras hubiéramos hubierais
    hubieran hubiese hubieses hubiésemos hubieseis hubiesen habiendo habido
    habida habidos habidas soy eres es somos sois son sea seas seamos seáis
    sean seré serás será seremos seréis serán sería serías seríamos
    seríais serían era eras éramos erais eran fui fuiste fue fuimos
    fuisteis fueron fuera fueras fuéramos fuerais fueran fuese fueses
    fuésemos fueseis fuesen sintiendo sentido sentida sentidos sentidas
    siente sentid tengo tienes tiene tenemos tenéis tienen tenga tengas
    tengamos tengáis tengan tendré tendrás tendrá tendremos tendréis
    tendrán tendría tendrías tendríamos tendríais tendrían tenía
    tenías teníamos teníais tenían tuve tuviste tuvo tuvimos tuvisteis
    tuvieron tuviera tuvieras tuviéramos tuvierais tuvieran tuviese
    tuvieses tuviésemos tuvieseis tuviesen teniendo tenido tenida tenidos
    tenidas tened
    """.split()),

    "sv": frozenset("""
    och det att i en jag hon som han på den med var sig för så till är
    men ett om hade de av icke mig du henne då sin nu har inte hans honom
    skulle hennes där min man ej vid kunde något från ut när efter upp
    vi dem vara vad över än dig kan sina här ha mot alla under någon
    eller allt mycket sedan ju denna själv detta åt utan varit hur ingen
    mitt ni bli blev oss din dessa några deras blir mina samma vilken er
    sådan vår blivit dess inom mellan sådant varför varje vilka ditt vem
    vilket sitta sådana vart dina vars vårt våra ert era vilkas
    """.split()),

    "tr": frozenset("""
    acaba ama aslında az bazı belki biri birkaç birşey biz bu çok
    çünkü da daha de defa diye eğer en gibi hem hep hepsi her hiç için
    ile ise kez ki kim mı mu mü nasıl ne neden nerde nerede nereye niçin
    niye o sanki şey siz şu tüm ve veya ya yani
    """.split()),
}
