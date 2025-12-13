import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import './VisualNarrative.css';

const YEAR_MIN = 2009;
const YEAR_MAX = 2025;

function VisualNarrative() {
  const [allData, setAllData] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [yearRange, setYearRange] = useState({ start: YEAR_MIN, end: YEAR_MAX });
  const [yearInputs, setYearInputs] = useState({ start: String(YEAR_MIN), end: String(YEAR_MAX) });

  // Chart refs
  const genreRef = useRef(null);
  const durationRef = useRef(null);
  const avgTrackTimeRef = useRef(null);
  const topArtistsRef = useRef(null);
  const topTracksRef = useRef(null);
  const genreTrendRef = useRef(null);

  // Load both datasets
  useEffect(() => {
    Promise.all([
      d3.csv('/data/track_data_final.csv'),
      d3.csv('/data/spotify_data clean.csv')
    ]).then(([historical, modern]) => {
      // Helper function to validate date
      const isValidDate = (dateStr) => {
        if (!dateStr) return false;
        const year = new Date(dateStr).getFullYear();
        return !isNaN(year) && year >= 2009 && year <= 2025;
      };

      // Parse historical data (2009-2023)
      const parsedHistorical = historical
        .filter(d => isValidDate(d.album_release_date))
        .map((d) => ({
          track_id: d.track_id,
          track_name: d.track_name,
          track_popularity: +d.track_popularity || 0,
          track_duration_ms: +d.track_duration_ms || 0,
          explicit: d.explicit === 'True' || d.explicit === true,
          artist_name: d.artist_name,
          artist_popularity: +d.artist_popularity || 0,
          artist_followers: +d.artist_followers || 0,
          artist_genres: parseGenres(d.artist_genres),
          album_name: d.album_name,
          album_release_date: d.album_release_date,
          album_type: d.album_type,
          period: 'historical'
        }));

      // Parse modern data (2025)
      const parsedModern = modern
        .filter(d => isValidDate(d.album_release_date))
        .map((d) => ({
          track_id: d.track_id,
          track_name: d.track_name,
          track_popularity: +d.track_popularity || 0,
          track_duration_min: +d.track_duration_min || 0,
          track_duration_ms: (d.track_duration_min || 0) * 60000,
          explicit: d.explicit === 'TRUE' || d.explicit === true,
          artist_name: d.artist_name,
          artist_popularity: +d.artist_popularity || 0,
          artist_followers: +d.artist_followers || 0,
          artist_genres: parseGenres(d.artist_genres),
          album_name: d.album_name,
          album_release_date: d.album_release_date,
          album_type: d.album_type,
          period: 'modern'
        }));

      setAllData([...parsedHistorical, ...parsedModern]);
    }).catch((err) => {
      console.error('Error loading datasets:', err);
    });
  }, []);


  // Redraw charts on data or genre change
  useEffect(() => {
    if (allData.length > 0) {
      drawGenreChart();
      drawDurationDistribution();
      drawAvgTrackTime();
      drawTopArtists();
      drawTopTracksChart();
      drawGenreTrend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allData, selectedGenre, yearRange]);

  function parseGenres(genreStr) {
    if (!genreStr) return [];
    if (Array.isArray(genreStr)) return genreStr.filter(g => g && g.toLowerCase() !== 'n/a');
    try {
      // Remove brackets, split by comma, then clean up quotes and whitespace
      return String(genreStr)
        .replace(/\[|\]/g, '')
        .split(',')
        .map(g => g.trim().replace(/^['"]+|['"]+$/g, ''))
        .filter(g => g.length > 0 && g.toLowerCase() !== 'n/a');
    } catch {
      return [];
    }
  }

  function formatGenres(genres, max = 2) {
    if (!Array.isArray(genres) || !genres.length) return '';
    const trimmed = genres.slice(0, max).map(g => g.trim()).filter(Boolean);
    if (!trimmed.length) return '';
    const suffix = trimmed.join(', ');
    const ellipsis = genres.length > max ? '…' : '';
    return ` (${suffix}${ellipsis})`;
  }

  function hasPopularityScore(value) {
    return typeof value === 'number' && !Number.isNaN(value);
  }

  function createDurationHistogram(values, min = 0, max = 10, binCount = 20) {
    if (!Array.isArray(values) || !values.length) return [];
    const range = max - min;
    if (range <= 0 || binCount <= 0) return [];
    const binSize = range / binCount;
    const bins = Array.from({ length: binCount }, (_, idx) => ({
      x0: min + idx * binSize,
      x1: min + (idx + 1) * binSize,
      length: 0
    }));
    values.forEach((value) => {
      if (typeof value !== 'number' || Number.isNaN(value)) return;
      if (value < min || value > max) return;
      let binIndex = Math.floor((value - min) / binSize);
      if (binIndex >= binCount) binIndex = binCount - 1;
      if (binIndex < 0) binIndex = 0;
      bins[binIndex].length += 1;
    });
    return bins.filter(b => b.length > 0);
  }

  function getExtent(values) {
    if (!Array.isArray(values) || !values.length) return [null, null];
    let min = Infinity;
    let max = -Infinity;
    values.forEach((value) => {
      if (typeof value !== 'number' || Number.isNaN(value)) return;
      if (value < min) min = value;
      if (value > max) max = value;
    });
    if (min === Infinity || max === -Infinity) return [null, null];
    return [min, max];
  }

  const clampYear = (value) => {
    if (Number.isNaN(value)) return YEAR_MIN;
    return Math.max(YEAR_MIN, Math.min(YEAR_MAX, value));
  };

  const updateYearRange = (type, rawValue) => {
    const value = clampYear(Math.round(rawValue));
    setYearRange(prev => {
      if (type === 'start') {
        const start = Math.min(value, prev.end);
        const end = prev.end < start ? start : prev.end;
        return { start, end };
      }
      const end = Math.max(value, prev.start);
      const start = prev.start > end ? end : prev.start;
      return { start, end };
    });
  };

  const handleYearSliderChange = (type) => (e) => {
    const value = Number(e.target.value);
    updateYearRange(type, value);
  };

  const handleYearInputChange = (type) => (e) => {
    const value = e.target.value;
    if (!/^\d*$/.test(value)) return;
    setYearInputs((prev) => ({ ...prev, [type]: value }));
  };

  const commitYearInput = (type) => () => {
    const raw = Number(yearInputs[type]);
    if (Number.isNaN(raw)) {
      setYearInputs(prev => ({ ...prev, [type]: String(yearRange[type]) }));
      return;
    }
    updateYearRange(type, raw);
  };

  useEffect(() => {
    setYearInputs({ start: String(yearRange.start), end: String(yearRange.end) });
  }, [yearRange.start, yearRange.end]);

  function getFilteredData() {
    let filtered = allData;
    
    // Apply genre filter - exact match (case-insensitive)
    if (selectedGenre !== 'All') {
      filtered = filtered.filter((d) => {
        if (!Array.isArray(d.artist_genres)) return false;
        return d.artist_genres.some(g => g.toLowerCase() === selectedGenre.toLowerCase());
      });
    }
    
    // Apply custom year range filter
    filtered = filtered.filter(d => {
      let year = null;
      if (d.period === 'modern') {
        year = d.album_release_date ? new Date(d.album_release_date).getFullYear() : YEAR_MAX;
      } else if (d.album_release_date) {
        year = new Date(d.album_release_date).getFullYear();
      }

      if (year === null || isNaN(year)) return false;
      if (year < YEAR_MIN || year > YEAR_MAX) return false;
      return year >= yearRange.start && year <= yearRange.end;
    });
    
    return filtered;
  }

  function getStatistics() {
    const filtered = getFilteredData();
    if (!filtered.length) return { avgPop: 0, avgDuration: 0, trackCount: 0 };
    
    const avgPop = (d3.mean(filtered, d => d.track_popularity) || 0).toFixed(1);
    const avgDuration = (d3.mean(filtered, d => (d.track_duration_ms || 0) / 60000) || 0).toFixed(2);
    const trackCount = filtered.length;
    
    // Find top song
    return { avgPop, avgDuration, trackCount };
  }

  function drawGenreChart() {
    const svg = d3.select(genreRef.current);
    svg.selectAll('*').remove();
    const width = 430, height = 300;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const dataset = getFilteredData();
    if (!dataset.length) return;

    // Count by genre
    const genreCounts = {};
    dataset.forEach(d => {
      if (Array.isArray(d.artist_genres)) {
        d.artist_genres.forEach(g => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
      }
    });

    const data = Object.entries(genreCounts)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // Safety check for empty data
    if (!data.length) return;

    const margin = { top: 20, right: 20, bottom: 80, left: 50 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const x = d3.scaleBand().domain(data.map(d => d.genre)).range([0, innerW]).padding(0.1);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count)]).range([innerH, 0]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(x))
      .selectAll('text').attr('transform', 'rotate(-45)').attr('text-anchor', 'end').style('font-size', '10px');
    g.append('g').call(d3.axisLeft(y));

    g.selectAll('rect').data(data).enter().append('rect')
      .attr('x', d => x(d.genre)).attr('y', d => y(d.count)).attr('width', x.bandwidth()).attr('height', d => innerH - y(d.count))
      .attr('fill', '#2ca02c').attr('opacity', 0.8)
      .on('mouseover', (e, d) => showTooltip(e, `${d.genre}: ${d.count} tracks`))
      .on('mouseout', hideTooltip);
  }

  function drawDurationDistribution() {
    const svg = d3.select(durationRef.current);
    svg.selectAll('*').remove();
    const width = 430, height = 300;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const dataset = getFilteredData();
    if (!dataset.length) return;

    // Duration bins (in minutes)
    const durations = dataset
      .map(d => (d.track_duration_ms || 0) / 60000)
      .filter(value => typeof value === 'number' && !Number.isNaN(value));

    if (!durations.length) return;

    const histogram = createDurationHistogram(durations, 0, 10, 20);

    // Safety check for empty histogram
    if (!histogram.length) return;

    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const x = d3.scaleLinear()
      .domain([0, 10])
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(histogram, d => d.length)])
      .nice()
      .range([innerH, 0]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x)
        .tickValues(d3.range(0, 11))
        .tickFormat(d3.format('d')));
    g.append('g').call(d3.axisLeft(y));
    g.append('text').attr('x', innerW / 2).attr('y', innerH + 25).attr('text-anchor', 'middle').style('font-size', '12px').text('Duration (minutes)');

    g.selectAll('rect').data(histogram).enter().append('rect')
      .attr('x', d => x(d.x0))
      .attr('y', d => y(d.length))
      .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr('height', d => innerH - y(d.length))
      .attr('fill', '#d62728').attr('opacity', 0.8)
      .on('mouseover', (e, d) => showTooltip(e, `${d.x0.toFixed(1)}-${d.x1.toFixed(1)} min: ${d.length} tracks`))
      .on('mouseout', hideTooltip);
  }

  function drawAvgTrackTime() {
    const svg = d3.select(avgTrackTimeRef.current);
    svg.selectAll('*').remove();
    const width = 430;
    const height = 300;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const dataset = getFilteredData();
    if (!dataset.length) return;

    const yearStats = new Map();
    dataset.forEach((d) => {
      const dateStr = d.album_release_date;
      if (!dateStr) return;
      const year = new Date(dateStr).getFullYear();
      if (!year || Number.isNaN(year)) return;
      if (year < YEAR_MIN || year > YEAR_MAX) return;
      const durationMinutes = (d.track_duration_ms || 0) / 60000;
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return;
      if (!yearStats.has(year)) {
        yearStats.set(year, { sum: 0, count: 0 });
      }
      const stats = yearStats.get(year);
      stats.sum += durationMinutes;
      stats.count += 1;
    });

    const data = Array.from(yearStats.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, stats]) => ({ year, avg: stats.sum / stats.count }));

    if (!data.length) return;

    const margin = { top: 24, right: 20, bottom: 36, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const yearsExtent = getExtent(data.map(d => d.year));
    if (yearsExtent[0] == null || yearsExtent[1] == null) return;

    const yMinRaw = d3.min(data, d => d.avg) || 0;
    const yMaxRaw = d3.max(data, d => d.avg) || 0;
    if (yMaxRaw === 0) return;
    const yPadding = 0.2;
    const yMin = Math.max(0, Math.floor((yMinRaw - yPadding) * 10) / 10);
    const yMax = Math.ceil((yMaxRaw + yPadding) * 10) / 10;

    const x = d3.scaleLinear()
      .domain(yearsExtent)
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain([yMin, yMax]).nice()
      .range([innerH, 0]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat(d3.format('d')));

    g.append('g')
      .call(d3.axisLeft(y));

    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .text('Release Year');

    g.append('text')
      .attr('x', 0)
      .attr('y', -10)
      .style('font-size', '11px')
      .style('font-weight', 600)
      .text('Avg Track Duration (min)');

    const lineGenerator = d3.line()
      .curve(d3.curveMonotoneX)
      .x(d => x(d.year))
      .y(d => y(d.avg));

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#1f77b4')
      .attr('stroke-width', 2.5)
      .attr('d', lineGenerator);

    g.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.year))
      .attr('cy', d => y(d.avg))
      .attr('r', 3)
      .attr('fill', '#1f77b4')
      .on('mouseover', (e, d) => showTooltip(e, `${d.year}: ${d.avg.toFixed(2)} min`))
      .on('mouseout', hideTooltip);
  }

  function drawTopArtists() {
    const svg = d3.select(topArtistsRef.current);
    svg.selectAll('*').remove();
    const width = 550;
    const height = 360;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const dataset = getFilteredData();
    if (!dataset.length) return;

    // Get top artists by follower count
    const artistMap = new Map();
    dataset.forEach(d => {
      if (d.artist_name && d.artist_followers) {
        if (!artistMap.has(d.artist_name)) {
          artistMap.set(d.artist_name, {
            followers: d.artist_followers,
            genres: new Set()
          });
        }
        const artistEntry = artistMap.get(d.artist_name);
        artistEntry.followers = Math.max(artistEntry.followers, d.artist_followers);
        if (Array.isArray(d.artist_genres)) {
          d.artist_genres.forEach(g => artistEntry.genres.add(g));
        }
      }
    });

    const topArtists = Array.from(artistMap.entries())
      .map(([name, data]) => ({
        name,
        followers: data.followers,
        genres: Array.from(data.genres)
      }))
      .sort((a, b) => b.followers - a.followers)
      .slice(0, 10);

    if (!topArtists.length) return;

    const margin = { top: 20, right: 40, bottom: 35, left: 230 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const artistWithLabels = topArtists.map((d) => ({
      ...d,
      label: `${d.name}${formatGenres(d.genres)}`
    }));

    const y = d3.scaleBand()
      .domain(artistWithLabels.map(d => d.label))
      .range([0, innerH])
      .padding(0.2);

    const xMax = d3.max(artistWithLabels, d => d.followers) || 1;
    const x = d3.scaleLinear()
      .domain([0, xMax])
      .nice()
      .range([0, innerW]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('font-size', '11px')
      .style('font-weight', 500)
      .attr('text-anchor', 'end');

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${(d / 1e6).toFixed(0)}M`))
      .selectAll('text')
      .style('font-size', '10px');

    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 28)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .text('Followers (millions)');

    g.selectAll('rect')
      .data(artistWithLabels)
      .enter()
      .append('rect')
      .attr('x', 0)
      .attr('y', d => y(d.label))
      .attr('width', d => x(d.followers))
      .attr('height', y.bandwidth())
      .attr('fill', '#9467bd')
      .attr('opacity', 0.85)
      .on('mouseover', (e, d) => showTooltip(e, `${d.name}${formatGenres(d.genres)}: ${(d.followers / 1e6).toFixed(2)}M followers`))
      .on('mouseout', hideTooltip);

    g.selectAll('.value-label')
      .data(artistWithLabels)
      .enter()
      .append('text')
      .attr('class', 'value-label')
      .attr('x', d => x(d.followers) + 6)
      .attr('y', d => y(d.label) + y.bandwidth() / 2 + 4)
      .style('font-size', '10px')
      .style('font-weight', 600)
      .style('fill', '#333')
      .text(d => `${(d.followers / 1e6).toFixed(1)}M`);
  }

  function drawTopTracksChart() {
    const svg = d3.select(topTracksRef.current);
    svg.selectAll('*').remove();
    const width = 550, height = 400;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const dataset = getFilteredData();
    if (!dataset.length) return;

    // Get top 10 tracks by popularity
    const sortedTracks = [...dataset]
      .filter(d => d.track_name && hasPopularityScore(d.track_popularity))
      .sort((a, b) => b.track_popularity - a.track_popularity);

    const uniqueTopTracks = [];
    const seenTrackKeys = new Set();
    sortedTracks.forEach((track) => {
      if (uniqueTopTracks.length >= 10) return;
      const key = track.track_id || `${track.track_name}-${track.artist_name}`;
      if (seenTrackKeys.has(key)) return;
      seenTrackKeys.add(key);
      uniqueTopTracks.push(track);
    });

    const topTracks = uniqueTopTracks.map((d, i) => {
      const fullName = d.track_name || `Track ${i + 1}`;
      const displayName = fullName.length > 25 ? `${fullName.substring(0, 23)}...` : fullName;
      return {
        id: d.track_id || `${fullName}-${d.artist_name || 'unknown'}-${i}`,
        rank: i + 1,
        name: displayName,
        fullName,
        artist: d.artist_name,
        popularity: d.track_popularity,
        genres: Array.isArray(d.artist_genres) ? d.artist_genres : []
      };
    });

    // Safety check for empty tracks
    if (!topTracks.length) return;

    const margin = { top: 15, right: 50, bottom: 45, left: 180 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const x = d3.scaleLinear().domain([0, 100]).range([0, innerW]);
    const trackLabelLookup = new Map(topTracks.map(d => [d.id, `${d.name}${formatGenres(d.genres)}`]));
    const y = d3.scaleBand().domain(topTracks.map(d => d.id)).range([0, innerH]).padding(0.25);

    // Color scale from hot pink to lighter pink
    const colorScale = d3.scaleLinear().domain([0, 9]).range(['#ff1493', '#ffb6c1']);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Y axis with rank numbers
    g.append('g').call(d3.axisLeft(y).tickFormat(id => trackLabelLookup.get(id) || id))
      .selectAll('text')
      .style('font-size', '11px')
      .style('font-weight', '500');
    
    // X axis
    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => d))
      .selectAll('text').style('font-size', '10px');
    
    // X axis label
    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 25)
      .attr('text-anchor', 'middle').style('font-size', '11px').text('Popularity Score');

    // Bars with gradient colors
    g.selectAll('rect').data(topTracks).enter().append('rect')
      .attr('x', 0).attr('y', d => y(d.id))
      .attr('width', d => x(d.popularity)).attr('height', y.bandwidth())
      .attr('fill', (d, i) => colorScale(i))
      .attr('rx', 3).attr('ry', 3)
      .on('mouseover', (e, d) => {
        const genreText = formatGenres(d.genres);
        showTooltip(e, `<strong>#${d.rank} "${d.fullName}"</strong><br/>by ${d.artist}${genreText}<br/>Popularity: ${d.popularity}`);
      })
      .on('mouseout', hideTooltip);
    
    // Value labels at end of bars
    g.selectAll('.value-label').data(topTracks).enter().append('text')
      .attr('class', 'value-label')
      .attr('x', d => x(d.popularity) + 5).attr('y', d => y(d.id) + y.bandwidth() / 2 + 4)
      .style('font-size', '10px').style('font-weight', '600').style('fill', '#333')
      .text(d => d.popularity);
  }

  function drawGenreTrend() {
    const svg = d3.select(genreTrendRef.current);
    svg.selectAll('*').remove();
    const width = 550;
    const height = 340;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const dataset = getFilteredData();
    if (!dataset.length) return;

    // Determine top 5 genres by track count within filters
    const genreCounts = new Map();
    dataset.forEach(d => {
      if (!Array.isArray(d.artist_genres)) return;
      d.artist_genres.forEach(g => {
        if (!g) return;
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
      });
    });

    const topGenres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre]) => genre);

    if (!topGenres.length) return;

    const genreSet = new Set(topGenres);
    const genreYearMap = new Map();
    const allYears = new Set();

    dataset.forEach(d => {
      if (!Array.isArray(d.artist_genres) || !hasPopularityScore(d.track_popularity)) return;
      const dateStr = d.album_release_date;
      if (!dateStr) return;
      const year = new Date(dateStr).getFullYear();
      if (!year || isNaN(year)) return;
      d.artist_genres.forEach((g) => {
        if (!genreSet.has(g)) return;
        if (!genreYearMap.has(g)) genreYearMap.set(g, new Map());
        const yearMap = genreYearMap.get(g);
        if (!yearMap.has(year)) yearMap.set(year, { sum: 0, count: 0 });
        const stats = yearMap.get(year);
        stats.sum += d.track_popularity;
        stats.count += 1;
        allYears.add(year);
      });
    });

    const lines = [];
    genreYearMap.forEach((yearMap, genre) => {
      const values = Array.from(yearMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([year, stats]) => ({ year, value: stats.sum / stats.count }));
      if (values.length > 0) {
        lines.push({ genre, values });
      }
    });

    if (!lines.length) return;

    const margin = { top: 32, right: 120, bottom: 40, left: 50 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const yearsExtent = getExtent(Array.from(allYears));
    if (yearsExtent[0] == null || yearsExtent[1] == null) return;

    const x = d3.scaleLinear()
      .domain(yearsExtent)
      .range([0, innerW]);

    const y = d3.scaleLinear().domain([0, 100]).nice().range([innerH, 0]);
    const color = d3.scaleOrdinal()
      .domain(topGenres)
      .range(['#5e60ce', '#64dfdf', '#ff6b6b', '#ffa62b', '#00b894']);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat(d3.format('d')));
    g.append('g')
      .call(d3.axisLeft(y));

    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 32)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .text('Release Year');

    g.append('text')
      .attr('x', 0)
      .attr('y', -12)
      .style('font-size', '11px')
      .style('font-weight', 600)
      .text('Avg Popularity');

    const lineGenerator = d3.line()
      .curve(d3.curveMonotoneX)
      .x(d => x(d.year))
      .y(d => y(d.value));

    const series = g.selectAll('.genre-line')
      .data(lines)
      .enter()
      .append('g')
      .attr('class', 'genre-line');

    series.append('path')
      .attr('fill', 'none')
      .attr('stroke', d => color(d.genre))
      .attr('stroke-width', 2.5)
      .attr('d', d => lineGenerator(d.values));

    series.selectAll('circle')
      .data(d => d.values.map(v => ({ ...v, genre: d.genre })))
      .enter()
      .append('circle')
      .attr('cx', d => x(d.year))
      .attr('cy', d => y(d.value))
      .attr('r', 3)
      .attr('fill', d => color(d.genre))
      .on('mouseover', (e, d) => showTooltip(e, `${d.genre} · ${d.year}: ${d.value.toFixed(1)}`))
      .on('mouseout', hideTooltip);

    const legend = g.append('g')
      .attr('transform', `translate(${innerW + 20},0)`);

    lines.forEach((line, idx) => {
      const legendRow = legend.append('g')
        .attr('transform', `translate(0, ${idx * 22})`);
      legendRow.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', color(line.genre))
        .attr('rx', 2);
      legendRow.append('text')
        .attr('x', 18)
        .attr('y', 10)
        .style('font-size', '11px')
        .text(line.genre);
    });
  }

  function showTooltip(e, text) {
    let tooltip = d3.select('#vn-tooltip');
    if (!tooltip.node()) {
      tooltip = d3.select('body').append('div').attr('id', 'vn-tooltip').attr('class', 'vn-tooltip');
    }
    tooltip.style('left', (e.pageX + 12) + 'px').style('top', (e.pageY + 12) + 'px').style('opacity', 1).html(text);
  }

  function hideTooltip() {
    d3.select('#vn-tooltip').style('opacity', 0).html('');
  }

  const allGenres = React.useMemo(() => {
    const genres = new Set();
    allData.forEach(d => {
      if (Array.isArray(d.artist_genres)) d.artist_genres.forEach(g => genres.add(g));
    });
    const sortedGenres = Array.from(genres).sort();
    return ['All', ...sortedGenres];
  }, [allData]);

  const stats = getStatistics();
  const totalYearSpan = YEAR_MAX - YEAR_MIN;
  const startPercent = ((yearRange.start - YEAR_MIN) / totalYearSpan) * 100;
  const endPercent = ((yearRange.end - YEAR_MIN) / totalYearSpan) * 100;
  const cappedStart = Math.min(Math.max(startPercent, 0), 100);
  const availableWidth = Math.max(100 - cappedStart, 0);
  let highlightWidth = endPercent - startPercent;
  if (availableWidth === 0) {
    highlightWidth = 0;
  } else {
    if (highlightWidth <= 0) highlightWidth = Math.min(availableWidth, 1);
    highlightWidth = Math.min(Math.max(highlightWidth, 1), availableWidth);
  }
  const rangeHighlightStyle = {
    left: `${cappedStart}%`,
    width: `${highlightWidth}%`
  };

  return (
    <div className="visual-narrative">
      <div className="vn-hero">
        <h1>Spotify Global Music Analysis (2009–2025)</h1>
        <p className="vn-subtitle">Explore 16+ years of music trends, artist evolution, and listener preferences across genres.</p>
      </div>

      {/* Interactive Controls */}
      <div className="vn-controls-panel">
        <div className="vn-control-group">
          <label className="vn-filter-label">
            📍 Genre Filter:
            <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="vn-select">
              {allGenres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        </div>

        <div className="vn-control-group vn-control-group--slider">
          <label className="vn-filter-label">⏳ Time Range:</label>
          <div className="vn-range-control">
            <div className="vn-range-values">
              <label className="vn-range-value-field">
                <span>From</span>
                <input
                  type="number"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={yearInputs.start}
                  onChange={handleYearInputChange('start')}
                  onBlur={commitYearInput('start')}
                  onKeyDown={(e) => e.key === 'Enter' && commitYearInput('start')()}
                  className="vn-range-value-input"
                />
              </label>
              <label className="vn-range-value-field">
                <span>To</span>
                <input
                  type="number"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={yearInputs.end}
                  onChange={handleYearInputChange('end')}
                  onBlur={commitYearInput('end')}
                  onKeyDown={(e) => e.key === 'Enter' && commitYearInput('end')()}
                  className="vn-range-value-input"
                />
              </label>
            </div>
            <div className="vn-range-inputs">
              <div className="vn-range-track">
                <div className="vn-range-fill" style={rangeHighlightStyle}></div>
              </div>
              <input
                type="range"
                min={YEAR_MIN}
                max={YEAR_MAX}
                value={yearRange.start}
                onChange={handleYearSliderChange('start')}
                className="vn-range-slider"
                aria-label="Start year"
              />
              <input
                type="range"
                min={YEAR_MIN}
                max={YEAR_MAX}
                value={yearRange.end}
                onChange={handleYearSliderChange('end')}
                className="vn-range-slider"
                aria-label="End year"
              />
            </div>
            <div className="vn-range-hint">Drag the handles to focus on a specific release window.</div>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="vn-stats-grid">
        <div className="vn-stat-card">
          <div className="vn-stat-label">Avg Popularity</div>
          <div className="vn-stat-value">{stats.avgPop}</div>
        </div>
        <div className="vn-stat-card">
          <div className="vn-stat-label">Avg Duration</div>
          <div className="vn-stat-value">{stats.avgDuration} min</div>
        </div>
        <div className="vn-stat-card">
          <div className="vn-stat-label">Track Count</div>
          <div className="vn-stat-value">{stats.trackCount.toLocaleString()}</div>
        </div>
      </div>

      {/* Main 2 Charts (Story Points) */}
      <div className="vn-story-section">
        <h2>📊 The Two Data Stories</h2>
        <div className="vn-grid-4">
          <figure className="vn-card vn-primary">
            <figcaption>📈 Story 1: Genre Momentum</figcaption>
            <p className="vn-card-desc">Track how the five busiest genres under your filters rise or fall in average popularity every year.</p>
            <svg ref={genreTrendRef} className="vn-chart" role="img" aria-label="Genre popularity trends"></svg>
          </figure>

          <figure className="vn-card vn-primary">
            <figcaption>🎵 Story 2: Genre Market Share</figcaption>
            <p className="vn-card-desc">Spot which styles dominate the release slate once your filters are applied.</p>
            <svg ref={genreRef} className="vn-chart" role="img" aria-label="Genre bar chart"></svg>
          </figure>

          <figure className="vn-card vn-primary">
            <figcaption>🏆 Story 3: Top 10 Songs In Focus</figcaption>
            <p className="vn-card-desc">See which tracks dominate under the current filters. Perfect for playlist strategy, campaign planning, and talent scouting.</p>
            <svg ref={topTracksRef} className="vn-chart" role="img" aria-label="Top tracks chart"></svg>
          </figure>

          <figure className="vn-card vn-primary">
            <figcaption>⭐ Story 4: Artist Power & Influence</figcaption>
            <p className="vn-card-desc">Who are the industry leaders? Benchmark your artists against the most followed names in music.</p>
            <svg ref={topArtistsRef} className="vn-chart" role="img" aria-label="Top artists bar chart"></svg>
          </figure>
        </div>
      </div>

      {/* Supporting Visualizations */}
      <div className="vn-supporting-section">
        <h2>🔬 Supporting Analytics</h2>
        <div className="vn-grid-2">
          <figure className="vn-card">
            <figcaption>⏱️ Track Duration Distribution</figcaption>
            <svg ref={durationRef} className="vn-chart-small" role="img" aria-label="Duration histogram"></svg>
          </figure>
          <figure className="vn-card">
            <figcaption>📏 Avg Track Time by Year</figcaption>
            <p className="vn-card-desc">See how song runtimes evolve inside your filtered slice of the catalog.</p>
            <svg ref={avgTrackTimeRef} className="vn-chart-small" role="img" aria-label="Average track duration trend"></svg>
          </figure>
        </div>
      </div>

      {/* Decision Framework */}
      <div className="vn-framework">
        <h2>💡 Decision Framework: What These Stories Tell You</h2>
        <div className="vn-framework-grid">
          <div className="vn-framework-card">
            <h3>🎯 For A&R Professionals</h3>
            <ul>
              <li>Identify emerging genres gaining momentum</li>
              <li>Benchmark new artists against industry standards</li>
              <li>Spot underserved market segments</li>
            </ul>
          </div>
          <div className="vn-framework-card">
            <h3>📢 For Marketing Teams</h3>
            <ul>
              <li>Time releases to align with trend cycles</li>
              <li>Target promotions by genre performance</li>
              <li>Optimize track lengths for playlists</li>
            </ul>
          </div>
          <div className="vn-framework-card">
            <h3>🎚️ For Producers</h3>
            <ul>
              <li>Understand production trends by era</li>
              <li>Compare your sound to market leaders</li>
              <li>Optimize duration for streaming impact</li>
            </ul>
          </div>
          <div className="vn-framework-card">
            <h3>🤝 For Record Labels</h3>
            <ul>
              <li>Portfolio diversification by genre health</li>
              <li>Artist ROI benchmarking</li>
              <li>Strategic acquisition targeting</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VisualNarrative;
