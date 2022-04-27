# Lightweight AfreecaTV API

## About
AfreecaTV is notorious for its poor performance, as a lot of pages take forever to load. This
project aims to significantly reduce load times, by storing some data locally & getting rid of
unnecessary information. </br>
It is essentially equivalent to your favourite streamers section on Afreeca, but you can access it
instantaneously, with new data being dynamically fetched and appended. </br>
Read the future work section if you're interested in the development of this project / projects related to it & check out the Findings section for issues/security flaws that I've reported to Afreeca. </br>
A live preview of this project is available at: https://afreeca-vods-frontend.vercel.app/. (turned off due to people using it to collect weird vods)
It is NOT yet optimized for mobile. First launch will take a little while (backend is hosted on heroku & the web dyno needs to wake up).

## Features
- Fully documented using JSDocs & OpenAPI spec, available for live preview in `./docs/`.
The OpenAPI docs are also available on : https://snothy.github.io/afreeca-vods-backend/
- Browse current top livestreams
- A favourite streamers list, from which you can add & remove streamers
- A list of all available Vods for each streamer added to the favourite list
- Dynamically updates the vod list when new vods are available (frontend)

## Requirements
PostgreSQL & Node.js
Tested on `Node v16 & v17`.

## Installation
Use `npm install` or `npm i` to install dependencies.
Currently, no method of automatically building the database is available. But the sql scripts
are available in `./sql_scripts/`, so you can manually create the tables. </br>
You can connect the database by passing the PostgreSQL connection string as an environment
variable called `DATABASE_URL`, or manually setting the string inside of `./helpers/database.js`.

## Usage
Use `npm start`. Not using nodemon as of now, you can change it if you prefer it.

## Future work
- Due to the lack of publicly available documentation, some research has to be done in order to
access the data you need. A lot of this has been covered by this project and multiple API calls
have been simplified into single methods that process the data for you. But because they
have been written within the scope of this project, they aren't of much use for developers.
Which is why I'm working on creating an npm module that acts as a wrapper on Afreeca's API.

## Findings
1. Accessing private Vods
- It appears that saving the data for a vod makes it accessible even after the owner (streamer)
has removed it from their vod list (or privated it). </br>
The vod data consists of information about the vod & m3u8 playlists that make up the contents of the vod (video). It seems like they forgot to private the m3u8 urls & their individual segments, as they
are still accessible after a video has been privated. I have reported the issue.
