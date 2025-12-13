# cs450-project

This project contains a React app that implements a visual narrative for the Spotify Global Music dataset. The narrative is designed for music industry decision-makers who want evidence-based insights to guide promotion, production, and release strategy.

Target audience
- Record label executives, music producers, marketing strategists, independent artists.

User needs & decisions supported
- Identify emerging trends and shifts in listener preferences.
- Compare audio and metadata features of popular vs less-popular tracks.
- Prioritize artists, genres, or songs for promotion.
- Adjust release and marketing strategies based on historical insights.

How the dataset supports decisions
The dataset contains track- and artist-level attributes: track popularity, artist popularity and follower counts, release dates, album metadata, and many audio/metadata fields. Using this data, the visual narrative helps identify trends across time, relationships between track attributes and popularity, and genre/artist-specific patterns.

Visualization role
The React + D3 visual narrative converts high-dimensional CSV data into intuitive charts, letting users interactively filter and explore:
- Average track popularity over time (line chart).
- Track duration vs popularity (scatter/bubble chart sized by artist followers).
- Genre filtering and interactive tooltips for detail-on-demand.

To run locally
```bash
cd app
npm install
npm start
```
