# Design Choices to be defined

* How to create museums? At the moment it's handled via standard http requests, but the specs talk about a configuration file as a costraint.
* Content.type – keep the fixed enum ['Artwork', 'Artist', 'Movement', 'Place'] or allow any string?
* Item description granularity – are the current length categories ['3s','15s','45s'] and tones ['easy','medium','complex'] enough?
* Item – Should the description for each lenght be independent (full description but with different levels of details), or be complementary (e.g. 15s description add info to the 3s description).
* Item – should 'author' be an independent field (instead of being part of `associatedContents`)?
* Should we setup a cookies system?
