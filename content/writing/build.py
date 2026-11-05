import json, pathlib
CRIT = [dict(name="Content", description="Czy praca odpowiada na wszystkie punkty polecenia i czy czytelnik otrzymuje pełną informację."),
        dict(name="Communicative Achievement", description="Czy styl i rejestr pasują do typu tekstu i odbiorcy; czy tekst skutecznie realizuje cel (przekonuje, informuje, poleca)."),
        dict(name="Organisation", description="Czy tekst jest logicznie podzielony na akapity i spójny; czy używasz różnorodnych łączników."),
        dict(name="Language", description="Zakres i poprawność słownictwa oraz struktur gramatycznych, także tych mniej typowych.")]
NOTE = " Uwaga: ocena w aplikacji to samoocena według tych kryteriów – nie jest to ocena egzaminatora."
G = []
def guide(type, title, req, structure, phrases, task, text, tasks):
    G.append(dict(type=type, title=title, content=dict(requirements=req + NOTE, structure=[dict(part=a, content=b) for a, b in structure], phrases=[dict(en=a, pl=b) for a, b in phrases], sample=dict(task=task, text=text.strip()), criteria=CRIT, tasks=tasks)))

guide("essay", "Essay", "Esej to obowiązkowe zadanie w części Writing egzaminu C1 Advanced (zwykle 220–260 słów). Otrzymujesz temat, notatki z dyskusji i trzy aspekty – omawiasz dwa z nich, wskazujesz, który jest ważniejszy, i uzasadniasz wybór. Styl formalny lub neutralny.",
 [("Wstęp", "Przedstaw temat i jego znaczenie; zasygnalizuj, które dwa aspekty omówisz."), ("Akapit 1", "Pierwszy aspekt: argument, przykład, konsekwencja."), ("Akapit 2", "Drugi aspekt: argument, przykład, ewentualnie kontrargument."), ("Zakończenie", "Wskaż, który aspekt jest ważniejszy, i podaj powód. Nie dodawaj nowych argumentów.")],
 [("It is often argued that…", "Często twierdzi się, że…"), ("A key consideration is…", "Kluczową kwestią jest…"), ("This is particularly true of…", "Dotyczy to szczególnie…"), ("On the other hand, it could be argued that…", "Z drugiej strony można twierdzić, że…"), ("There is little doubt that…", "Nie ma wątpliwości, że…"), ("Admittedly, …", "Co prawda…"), ("On balance, I would argue that…", "Biorąc wszystko pod uwagę, uważam, że…"), ("The most compelling reason is…", "Najbardziej przekonującym powodem jest…")],
 "Your class has discussed ways in which governments can encourage people to lead healthier lives. Write an essay discussing two of the following: taxes on unhealthy food, free sports facilities, education campaigns. Explain which is more effective, giving reasons.",
 """
Governments around the world face a growing burden from illnesses linked to poor diet and inactivity. While individuals are ultimately responsible for their own habits, the state can do a great deal to make healthy choices easier. Two commonly proposed measures are taxing unhealthy food and providing free sports facilities.

Taxes on sugary drinks and processed snacks have the advantage of affecting behaviour quickly. When prices rise, consumption tends to fall, particularly among younger people with limited budgets. Moreover, the revenue can be invested in health services. Admittedly, such taxes are often criticised as unfair, since they take a larger share of the income of poorer households. They may also be seen as paternalistic, provoking resentment rather than change.

Free sports facilities, by contrast, encourage healthy behaviour without punishing anyone. Parks with outdoor gyms, swimming pools and local clubs give people of all ages the opportunity to be active, and they can strengthen communities as well as bodies. The main drawback is cost: building and maintaining facilities requires long-term investment, and their benefits may take years to appear.

On balance, I would argue that free sports facilities are the more effective option. Although taxes may produce faster results, they address only one aspect of the problem and risk alienating the very people they aim to help. Facilities, on the other hand, create positive habits that last, and they make healthy living something people choose rather than something imposed on them.
""", ["Your class has discussed how to reduce traffic in city centres. Write an essay discussing two of: congestion charges, better public transport, more cycle lanes. Explain which is most important.",
      "Your class has discussed ways of encouraging young people to vote. Write an essay discussing two of: lowering the voting age, online voting, political education at school.",
      "Your class has discussed how to protect the environment. Write an essay discussing two of: banning single-use plastics, investing in renewable energy, educating consumers."])

guide("report", "Report", "Raport (zadanie do wyboru w Part 2, zwykle 220–260 słów) pisze się dla przełożonego, komisji lub instytucji. Opisuje sytuację, ocenia ją i zawiera rekomendacje. Styl formalny, nagłówki, bezosobowe konstrukcje.",
 [("Introduction", "Cel raportu i źródło informacji (np. ankieta)."), ("Sekcje z nagłówkami", "Najważniejsze ustalenia, po jednym temacie na sekcję."), ("Recommendations", "Konkretne zalecenia wynikające z ustaleń.")],
 [("The aim of this report is to…", "Celem raportu jest…"), ("This report is based on…", "Raport opiera się na…"), ("It was found that…", "Stwierdzono, że…"), ("A significant number of respondents…", "Znaczna liczba respondentów…"), ("It would be advisable to…", "Wskazane byłoby…"), ("I would therefore recommend that…", "Dlatego zalecałbym, aby…")],
 "The manager of the sports centre where you work has asked you to write a report on how the centre is used by young people and how it could attract more of them.",
 """
Introduction
The aim of this report is to assess how the centre is currently used by people aged 16–25 and to suggest ways of increasing their participation. It is based on a survey of 120 members and informal conversations with staff.

Current use
It was found that young members visit mainly in the evenings and at weekends, and that the gym is by far the most popular facility. The swimming pool and group classes are used considerably less, largely because most sessions take place during the day, when the majority of students are at school or university.

Main concerns
A significant number of respondents considered the membership fee too high for those on low incomes. Others mentioned that the centre's online booking system is slow and that information about new classes is difficult to find. Several people also said that the atmosphere in some classes felt aimed at older members.

Recommendations
In light of these findings, I would recommend that the centre introduce a reduced student membership, perhaps limited to off-peak hours. It would also be advisable to schedule more classes after 6 p.m. and to promote them on social media, where most young people look for information. Finally, the centre could invite young members to suggest or even lead new activities, which would help to create a more welcoming atmosphere.

Conclusion
If these measures are adopted, the centre is likely to attract and retain a larger number of young members.
""", ["You work at a language school. The director has asked for a report on the school's social programme and how it could be improved.",
      "Your college wants to make the campus more environmentally friendly. Write a report describing current practices and recommending changes.",
      "Write a report for your local council on how well the town's public transport meets the needs of young people."])

guide("proposal", "Proposal", "Propozycja (Part 2, zwykle 220–260 słów) przedstawia plan i przekonuje odbiorcę, że warto go zrealizować. Podobna do raportu (nagłówki, styl formalny), ale skierowana w przyszłość.",
 [("Introduction", "Cel propozycji."), ("Opis pomysłu", "Co dokładnie proponujesz i dla kogo."), ("Korzyści", "Dlaczego warto; dla kogo i jak."), ("Realizacja / koszty", "Jak to zorganizować, ewentualne problemy i ich rozwiązanie."), ("Conclusion", "Podsumowanie i zachęta.")],
 [("The purpose of this proposal is to…", "Celem tej propozycji jest…"), ("I would like to suggest that…", "Chciałbym zaproponować, aby…"), ("This would enable…", "Umożliwiłoby to…"), ("One possible drawback is…", "Jedną z możliwych wad jest…"), ("This could be overcome by…", "Można by to rozwiązać przez…"), ("I am confident that…", "Jestem przekonany, że…")],
 "Your town has received money to improve a public space. Write a proposal for the town council suggesting how the money should be spent.",
 """
Introduction
The purpose of this proposal is to suggest how the funds recently awarded to our town could be used to improve the area around the old railway station, which is currently neglected and largely unused.

The idea
I would like to suggest that the empty land beside the station be transformed into a community garden with a small open-air stage. The garden would include raised vegetable beds that local residents could rent for a small fee, as well as benches, trees and a children's play area.

Benefits
This would give people in nearby flats, many of whom have no gardens of their own, the chance to grow food and spend time outdoors. The stage could host concerts, school performances and markets, bringing life back to a part of town that many people now avoid after dark. Local businesses near the station would also be likely to benefit from the increased number of visitors.

Practical considerations
One possible drawback is the cost of maintenance. This could be overcome by forming a volunteer group, supported by a part-time coordinator, and by using the rental income from the vegetable beds to cover basic expenses. It would also be advisable to consult residents before the design is finalised, so that the space reflects their needs.

Conclusion
I am confident that this project would offer excellent value for money and would turn an unattractive area into a place the whole community could enjoy.
""", ["Your college wants to improve students' wellbeing. Write a proposal suggesting one or two initiatives and explaining their benefits.",
      "A local museum wants to attract more young visitors. Write a proposal explaining what changes should be made.",
      "Your company wants to reduce its environmental impact. Write a proposal for the management."])

guide("review", "Review", "Recenzja (Part 2, zwykle 220–260 słów) opisuje i ocenia np. książkę, film, miejsce lub wydarzenie oraz zawiera rekomendację. Styl może być mniej formalny, ale język powinien być bogaty i obrazowy.",
 [("Tytuł i wstęp", "Przyciągnij uwagę czytelnika i przedstaw, co recenzujesz."), ("Opis", "Krótko – bez streszczania całej fabuły."), ("Ocena", "Mocne i słabe strony z konkretnymi przykładami."), ("Rekomendacja", "Dla kogo i dlaczego – lub dlaczego nie.")],
 [("What sets it apart is…", "Tym, co go wyróżnia, jest…"), ("It is well worth seeing", "Zdecydowanie warto to zobaczyć"), ("The plot is gripping/predictable", "Fabuła jest wciągająca/przewidywalna"), ("Where it falls short is…", "Słabszą stroną jest…"), ("I would wholeheartedly recommend it to…", "Z całego serca polecam to…"), ("It fails to live up to the hype", "Nie spełnia rozbudzonych oczekiwań")],
 "A website is collecting reviews of places that are popular with tourists but may be disappointing. Write a review of such a place, explaining whether it is worth visiting.",
 """
A Castle Worth Seeing – Just Not at Noon

With its fairy-tale towers and views over the river, the castle above my home town appears on almost every postcard of the region. Each summer, thousands of visitors climb the steep path to its gates. But is it really worth the effort?

The castle itself is undeniably impressive. The great hall, with its painted ceiling and enormous fireplace, is the highlight, and the small museum in the east tower offers a fascinating glimpse into the lives of the servants who once worked there. The audio guide, available in several languages, is informative without being overwhelming.

Where the experience falls short is in its organisation. Between eleven and three, coach parties arrive one after another, and the narrow corridors quickly become unbearably crowded. On my last visit, I spent more time queuing than looking at anything. The café, meanwhile, charges prices that would be considered excessive even in a capital city, and the food is distinctly ordinary.

Nevertheless, I would still recommend the castle, provided you plan carefully. Arrive when the gates open, or come in the late afternoon when the crowds have gone and the light on the river is at its most beautiful. Bring your own picnic and eat it in the gardens, which are free to enter and often overlooked. Visited this way, the castle lives up to its reputation; visited at midday, it may well leave you wondering what all the fuss is about.
""", ["Write a review of a film or series that made you think about an important issue.",
      "An international magazine wants reviews of restaurants that offer something unusual. Write a review.",
      "Write a review of a book that you think every teenager should read."])

guide("letter", "Formal letter / email", "List lub e-mail formalny (Part 2, zwykle 220–260 słów) – np. skarga, podanie, list do redakcji. Ton i cel muszą pasować do odbiorcy; pamiętaj o formułach otwarcia i zakończenia.",
 [("Otwarcie", "Dear Sir or Madam / Dear Ms Nowak + cel listu w pierwszym zdaniu."), ("Akapity główne", "Fakty, argumenty lub kwalifikacje – po jednym temacie w akapicie."), ("Oczekiwania", "Czego oczekujesz od odbiorcy."), ("Zakończenie", "Uprzejma formuła; Yours faithfully (gdy nie znasz nazwiska) / Yours sincerely (gdy znasz).")],
 [("I am writing with regard to…", "Piszę w związku z…"), ("I would be grateful if you could…", "Byłbym wdzięczny, gdyby…"), ("I was disappointed to find that…", "Z rozczarowaniem stwierdziłem, że…"), ("I feel I would be well suited to…", "Uważam, że dobrze nadawałbym się do…"), ("I look forward to hearing from you.", "Czekam na odpowiedź."), ("Please do not hesitate to contact me.", "Proszę śmiało się ze mną kontaktować.")],
 "You recently attended a conference that was poorly organised. Write a letter to the organisers explaining the problems and suggesting improvements.",
 """
Dear Sir or Madam,

I am writing with regard to the Young Professionals Conference held in Kraków on 14 October, which I attended as a delegate from my company. While several of the talks were genuinely inspiring, I was disappointed by a number of organisational problems which, I believe, significantly reduced the value of the event.

Firstly, the programme published on your website was changed without notice. Two of the sessions I had specifically registered for were cancelled, and no alternative was offered. As my employer had paid for my attendance largely because of these sessions, this was particularly frustrating.

Secondly, the venue was clearly too small for the number of participants. Many delegates had to stand at the back of the main hall, and the workshops were so crowded that meaningful discussion was impossible. The registration process was also extremely slow, with queues of over forty minutes on the first morning.

I appreciate that unexpected difficulties can arise. However, I would like to suggest that in future you inform participants of changes by email, limit workshop numbers through advance booking, and consider a larger venue. I would also be grateful if you could explain whether any partial refund will be offered for the cancelled sessions.

I hope my comments will be taken in the constructive spirit in which they are intended. I look forward to hearing from you.

Yours faithfully,
Anna Kowalska
""", ["You have seen an advertisement for volunteers at an international festival. Write a letter of application.",
      "Write a letter to a newspaper responding to an article which claimed that young people today are less hardworking than previous generations.",
      "Write an email to a hotel manager complaining about a recent stay and asking for compensation."])

p = pathlib.Path(__file__).parent.parent / "seed" / "writing_guides.json"
p.write_text(json.dumps(G, ensure_ascii=False, indent=1)); print(len(G), [len(g["content"]["sample"]["text"].split()) for g in G])
