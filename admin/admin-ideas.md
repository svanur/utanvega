# Idea bank for admin web

## Need to explore and plan better

[none yet]

## Backlog
- 'Harden' the slugify of trail names, turn spaces into dashes, remove special characters change icelandic to english etc
- Add 'History' table containing the 'utanvega' website history of changes and features
- On 'Upload GPX Trail': figure out in which location this trail is located.
- On 'Upload GPX Trail': check if this, or a part of this, trail exists and display a message: This trail is a 50% match to 'Trail X'
- Difficulty "calculator": Have a class 'DifficultyCalculator'(or some other name) and: Auto set the "Difficulty" status depending on the length and elevation of the trail
- Add a 'Map view': Display a pin for each trail on a map, click on the pin and display trail info: name, elevation and distance
- Add a 'Trail Health' page: display a list of all trails with 'health' indicator. If all information is entered, then health is 100%. IF some are missing, the health 'goes down'
- Bulk upload of GPX files: Create new Trail for each GPX file
- Add "Tags" to Trail - A Tag is some kind of a keyword, trail can have multiple tags

## Done
- Add columns to trail list: TrailType and Location
- Add a "Locations" feature to Trail
- - Add TrailType: point-to-point, out-and-back, etc. + CRUD