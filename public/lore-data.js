'use strict';
window.OrientLoreCatalog = [
 {id:'zoo-woodchuck',title:'A zoo that began with a woodchuck',teaser:'A small animal started something much bigger.',place:'Toledo Zoo',coordinates:[-83.582,41.619],body:'In 1900, a donated woodchuck became the starting point for the Toledo Zoo. The zoo’s own anniversary history traces its beginnings to that single animal, a surprisingly modest beginning for a Toledo landmark.',source:'https://www.toledozoo.org/anniversary',publisher:'Toledo Zoo & Aquarium'},
 {id:'studio-glass',title:'The garage that changed glass',teaser:'An artistic movement found its spark in a garage.',place:'Toledo Museum of Art',coordinates:[-83.5598,41.6596],body:'The Toledo Museum of Art identifies its 1962 garage workshops as the birthplace of the Studio Glass Movement. A small experimental furnace helped bring glassmaking into the hands of individual artists.',source:'https://store.toledomuseum.org/products/1962-toledo-workshops-historic-photograph-print',publisher:'Toledo Museum of Art'},
 {id:'valentine',title:'A Christmas opening, a second life',teaser:'A downtown stage has more than one beginning.',place:'Valentine Theatre',coordinates:[-83.5341,41.6534],body:'The Valentine Theatre opened on Christmas Day in 1895. After a major restoration, it reopened in October 1999 as a community arts center, giving its downtown stage another chapter.',source:'https://valentinetheatre.com/about',publisher:'Valentine Theatre'},
 {id:'glass-city-relics',title:'Industry hiding in the park',teaser:'Some park sculptures used to have a very different job.',place:'Glass City Metropark',coordinates:[-83.5258,41.6532],body:'Glass City Metropark preserves remnants of the site’s industrial past. Metroparks describes excavated industrial pieces transformed into sculpture and planting space: traces of work and machinery woven into today’s riverfront landscape.',source:'https://metroparkstoledo.com/glasscity',publisher:'Metroparks Toledo'},
 {id:'middlegrounds',title:'A railroad echo by the river',teaser:'A picnic shelter remembers what once stood nearby.',place:'Middlegrounds Metropark',coordinates:[-83.5354,41.6405],body:'The Rotary Roundhouse picnic shelter recalls a railroad roundhouse once located on the Middlegrounds property. Its shape offers a quiet reminder that this riverfront park has a working railroad past.',source:'https://metroparkstoledo.com/media/4192/mta-visitorguide-spring-2019-web.pdf',publisher:'Metroparks Toledo'}
].map(s=>({...s,city:'Toledo',category:'History',curated:'2026-10-08'})).concat([
  {
    "id": "mi-motown",
    "title": "A house with a worldwide sound",
    "teaser": "A modest house became a music landmark.",
    "place": "Motown Museum",
    "coordinates": [
      -83.0883,
      42.3641
    ],
    "body": "Berry Gordy founded Motown in 1959. The former Hitsville U.S.A. headquarters and Studio A are now preserved by Motown Museum, founded in 1985 by Esther Gordy Edwards. A building on West Grand Boulevard became part of a worldwide musical story.",
    "source": "https://www.motownmuseum.org/",
    "publisher": "Motown Museum",
    "category": "Music",
    "city": "Detroit",
    "curated": "2026-10-11"
  },
  {
    "id": "mi-rivera",
    "title": "A factory floor, painted around you",
    "teaser": "Look up: the room becomes an industrial landscape.",
    "place": "Detroit Institute of Arts",
    "coordinates": [
      -83.0644,
      42.3594
    ],
    "body": "Diego Rivera painted the Detroit Industry murals in 1932–1933. Twenty-seven fresco panels surround Rivera Court at the Detroit Institute of Arts, putting workers, machines, and the contradictions of industrial life into one room.",
    "source": "https://dia.org/collection/detroit-industry-murals/58537",
    "publisher": "Detroit Institute of Arts",
    "category": "Art",
    "city": "Detroit",
    "curated": "2026-10-11"
  },
  {
    "id": "mi-central",
    "title": "The station that got another chapter",
    "teaser": "A railway landmark found a second life.",
    "place": "Michigan Central Station",
    "coordinates": [
      -83.0775,
      42.3283
    ],
    "body": "Michigan Central Station served as Detroit’s principal passenger depot from 1913 to 1988. After decades of vacancy and a major restoration, it reopened in June 2024. The building’s history includes both the railway city and the city remaking itself.",
    "source": "https://www.detroithistorical.org/learn/online-research/encyclopedia-of-detroit/michigan-central-station",
    "publisher": "Detroit Historical Society",
    "category": "Architecture",
    "city": "Detroit",
    "curated": "2026-10-11"
  },
  {
    "id": "mi-parks-bus",
    "title": "An ordinary bus, an extraordinary refusal",
    "teaser": "A preserved vehicle carries a civil-rights turning point.",
    "place": "The Henry Ford",
    "coordinates": [
      -83.2327,
      42.3005
    ],
    "body": "The bus on which Rosa Parks refused to give up her seat in Montgomery on December 1, 1955, is preserved at The Henry Ford in Dearborn. The museum restored it after years as a discarded relic in Alabama. This Michigan pin marks the museum, not where the event occurred.",
    "source": "https://corporate.thehenryford.org/explore/inside/rosa-parks-bus",
    "publisher": "The Henry Ford",
    "category": "History",
    "city": "Dearborn",
    "curated": "2026-10-11"
  },
  {
    "id": "mi-grand-rapids",
    "title": "Why this was Furniture City",
    "teaser": "The city’s nickname has a workshop behind it.",
    "place": "Grand Rapids Public Museum",
    "coordinates": [
      -85.6768,
      42.9655
    ],
    "body": "Grand Rapids became known as Furniture City during the late nineteenth century. The Grand Rapids Public Museum’s furniture collection and factory exhibit document the craft, labor, and manufacturing behind that nickname.",
    "source": "https://www.grpm.org/furniture-factory-exhibit/",
    "publisher": "Grand Rapids Public Museum",
    "category": "Craft",
    "city": "Grand Rapids",
    "curated": "2026-10-11"
  },
  {
    "id": "mi-sleeping-bear",
    "title": "Dunes with a head start",
    "teaser": "Some of this sand is perched on a much older landscape.",
    "place": "Sleeping Bear Dunes",
    "coordinates": [
      -86.058,
      44.8805
    ],
    "body": "Many of Sleeping Bear’s great dunes sit on top of elevated glacial moraines. Wind reworked the sand above those deposits, creating perched dunes. Their height is a story of glaciers and wind working at different times.",
    "source": "https://www.nps.gov/articles/nps-geodiversity-atlas-sleeping-bear-dunes-national-lakeshore-michigan.htm",
    "publisher": "National Park Service",
    "category": "Nature",
    "city": "Sleeping Bear Dunes",
    "curated": "2026-10-11"
  },
  {
    "id": "mi-mackinac",
    "title": "A fort moved across the water",
    "teaser": "The island stronghold began with a strategic move.",
    "place": "Fort Mackinac",
    "coordinates": [
      -84.6189,
      45.8521
    ],
    "body": "In 1780, the British began moving their fort from the mainland at Michilimackinac to Mackinac Island, believing the old position too vulnerable. Fort Mackinac’s surviving buildings preserve layers of that military past.",
    "source": "https://www.mackinacparks.com/explore/history/fort-mackinac-history/",
    "publisher": "Mackinac State Historic Parks",
    "category": "History",
    "city": "Mackinac Island",
    "curated": "2026-10-11"
  },
  {
    "id": "mi-fayette",
    "title": "The iron town beside a quiet harbor",
    "teaser": "A peaceful waterfront once worked around blast furnaces.",
    "place": "Fayette Historic Townsite",
    "coordinates": [
      -86.668,
      45.719
    ],
    "body": "Fayette manufactured charcoal pig iron from 1867 to 1891. When smelting stopped, many workers and families left. The preserved townsite on Michigan’s Garden Peninsula holds the traces of a once-busy industrial community beside Snail Shell Harbor.",
    "source": "https://www.michigan.gov/recsearch/parks/Fayette",
    "publisher": "Michigan Department of Natural Resources",
    "category": "Industry",
    "city": "Fayette",
    "curated": "2026-10-11"
  },
  {
    "id": "chi-water-tower",
    "title": "A survivor in the city of rebuilding",
    "teaser": "This tower stood through Chicago’s great fire.",
    "place": "Chicago Water Tower",
    "coordinates": [
      -87.6244,
      41.8972
    ],
    "body": "Chicago’s Water Tower and Pumping Station survived the Great Fire of 1871. Among the streets rebuilt around them, these surviving structures offer a glimpse of the city before the disaster.",
    "source": "https://www.architecture.org/online-resources/buildings-of-chicago/chicago-water-tower",
    "publisher": "Chicago Architecture Center",
    "category": "Architecture",
    "city": "Chicago",
    "curated": "2026-10-11"
  },
  {
    "id": "chi-pullman",
    "title": "A model town with a complicated story",
    "teaser": "Railway cars, homes, and labor history meet here.",
    "place": "Pullman National Historical Park",
    "coordinates": [
      -87.6103,
      41.6912
    ],
    "body": "Construction of the planned Pullman town began in 1880, bringing rail-car factories, housing, and amenities together. Its model-town image also concealed deep conflicts over company control and workers’ lives, later central to the Pullman Strike of 1894.",
    "source": "https://www.nps.gov/pull/learn/historyculture/the-town-of-pullman.htm",
    "publisher": "National Park Service",
    "category": "Labor",
    "city": "Chicago",
    "curated": "2026-10-11"
  },
  {
    "id": "kc-shuttlecocks",
    "title": "A game imagined at giant scale",
    "teaser": "A museum lawn became an enormous playing field.",
    "place": "Nelson-Atkins Museum of Art",
    "coordinates": [
      -94.5809,
      39.045
    ],
    "body": "Claes Oldenburg and Coosje van Bruggen installed Shuttlecocks at the Nelson-Atkins in 1994. The oversized badminton pieces turned the museum lawn into a playful scene and became a Kansas City landmark after a controversial arrival.",
    "source": "https://nelson-atkins.org/art/exhibitions/inventing-the-shuttlecocks/",
    "publisher": "Nelson-Atkins Museum of Art",
    "category": "Art",
    "city": "Kansas City",
    "curated": "2026-10-11"
  },
  {
    "id": "kc-liberty",
    "title": "A city gathers to remember",
    "teaser": "This skyline landmark began as a public memorial.",
    "place": "Liberty Memorial",
    "coordinates": [
      -94.5861,
      39.0802
    ],
    "body": "Completed and dedicated in 1926, Liberty Memorial was created to honor those who served in World War I. President Calvin Coolidge attended its dedication before a crowd of more than 150,000 people. The monument anchors today’s National WWI Museum and Memorial.",
    "source": "https://www.theworldwar.org/marking-100-years",
    "publisher": "National WWI Museum and Memorial",
    "category": "History",
    "city": "Kansas City",
    "curated": "2026-10-11"
  }
]);
