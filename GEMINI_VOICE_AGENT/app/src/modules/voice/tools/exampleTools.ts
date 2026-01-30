import { register } from './toolRegistry.js';

/**
 * Example function calling tools for external APIs, databases, and services.
 */

register({
  name: 'execute_sql_query',
  description: 'Execute a SQL query on a database. Use this for data retrieval and analytics.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The SQL query to execute' },
      database: { type: 'string', description: 'The database name (optional, defaults to main)' },
    },
    required: ['query'],
  },
  handler: async (args) => {
    const { query, database = 'main' } = args;
    return {
      success: true,
      database,
      query,
      rows: [
        { id: 1, name: 'Example', value: 100 },
        { id: 2, name: 'Sample', value: 200 },
      ],
      rowCount: 2,
      message: 'Query executed successfully (simulated)',
    };
  },
});

register({
  name: 'get_analytics',
  description: 'Retrieve analytics data for a given time period and metric.',
  parameters: {
    type: 'object',
    properties: {
      metric: { type: 'string', description: 'The metric to retrieve (e.g., "users", "revenue", "conversions")' },
      startDate: { type: 'string', description: 'Start date in ISO format (YYYY-MM-DD)' },
      endDate: { type: 'string', description: 'End date in ISO format (YYYY-MM-DD)' },
    },
    required: ['metric', 'startDate', 'endDate'],
  },
  handler: async (args) => {
    const { metric, startDate, endDate } = args;
    return {
      metric,
      period: { start: startDate, end: endDate },
      value: 12345,
      trend: '+12.5%',
      dataPoints: [
        { date: startDate, value: 10000 },
        { date: endDate, value: 12345 },
      ],
      message: 'Analytics retrieved successfully (simulated)',
    };
  },
});

register({
  name: 'search_knowledge_base',
  description: 'Search the knowledge base for relevant information on a topic.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
      maxResults: { type: 'number', description: 'Maximum number of results to return (default: 5)' },
    },
    required: ['query'],
  },
  handler: async (args) => {
    const { query, maxResults = 5 } = args;
    return {
      query,
      results: [
        { title: 'Example Document 1', content: `Relevant information about ${query}`, relevance: 0.95 },
        { title: 'Example Document 2', content: `Additional context for ${query}`, relevance: 0.87 },
      ],
      totalResults: 2,
      message: 'Knowledge base search completed (simulated)',
    };
  },
});

register({
  name: 'call_external_api',
  description: 'Make a call to an external API endpoint.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The API endpoint URL' },
      method: { type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE)' },
      body: { type: 'object', description: 'Request body (for POST/PUT)' },
    },
    required: ['url', 'method'],
  },
  handler: async (args) => {
    const { url, method = 'GET', body } = args;
    return {
      url,
      method,
      status: 200,
      data: { message: 'API call successful (simulated)', timestamp: new Date().toISOString() },
    };
  },
});

register({
  name: 'get_weather',
  description: 'Get current weather information for a location.',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name or coordinates' },
      units: { type: 'string', description: 'Temperature units: celsius or fahrenheit' },
    },
    required: ['location'],
  },
  handler: async (args) => {
    const { location, units = 'celsius' } = args;
    return {
      location,
      temperature: units === 'celsius' ? 22 : 72,
      condition: 'Partly Cloudy',
      humidity: 65,
      windSpeed: 15,
      units,
      message: 'Weather data retrieved (simulated)',
    };
  },
});
