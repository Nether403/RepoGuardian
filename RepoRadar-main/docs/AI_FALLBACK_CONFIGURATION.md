# AI Fallback Configuration

RepoRadar uses a dual-AI system with Google Gemini 2.5 Pro as the primary AI provider and OpenAI GPT-5 as an optional fallback for enhanced reliability.

## Overview

The AI fallback system ensures continuous service availability by automatically switching to OpenAI GPT-5 when Gemini encounters issues such as:
- Rate limiting
- Service outages
- API errors
- Timeout issues

## Configuration

### Environment Variables

Add both API keys to your `.env` file:

```bash
# Primary AI Provider (Google Gemini)
GEMINI_API_KEY=your_gemini_api_key_here

# Fallback AI Provider (OpenAI)
OPENAI_API_KEY=your_openai_api_key_here
```

### API Key Setup

#### Google Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key to your `.env` file

#### OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key to your `.env` file

## Fallback Behavior

### Repository Analysis

1. **Primary**: Attempts analysis with Gemini 2.5 Pro (up to 3 retries with exponential backoff)
2. **Fallback**: If Gemini fails, automatically switches to OpenAI GPT-5
3. **Final Fallback**: If both AI services fail, returns basic metric-based analysis

### AI Assistant

1. **Primary**: Attempts to answer with Gemini 2.5 Pro (up to 2 retries)
2. **Fallback**: If Gemini fails, automatically switches to OpenAI GPT-5
3. **Error**: If both fail, returns appropriate error message

### AI Recommendations

Currently uses Gemini 2.5 Pro only. Future updates will add OpenAI fallback support.

## Cost Considerations

### Gemini 2.5 Pro (Primary)
- **Free Tier**: 15 requests per minute
- **Paid Tier**: Higher rate limits available
- **Cost**: Generally lower cost per request

### OpenAI GPT-5 (Fallback)
- **Model**: GPT-5 (latest generation)
- **Cost**: Pricing varies based on OpenAI tier
- **Rate Limits**: Depends on your OpenAI tier

### Optimization Tips

1. **Use Gemini as Primary**: Keep Gemini as primary to minimize costs
2. **Monitor Usage**: Track fallback frequency to identify issues
3. **Set Rate Limits**: Configure appropriate rate limits in your application
4. **Cache Results**: Enable caching to reduce API calls (see `PERFORMANCE_CONFIGURATION.md`)

## Monitoring

### Logs

The system logs AI provider usage:

```
Using OpenAI GPT-5 as fallback for repository analysis
Gemini not available, using OpenAI GPT-5 for AI assistant
```

### Metrics

Monitor these metrics to track fallback usage:
- Gemini success rate
- OpenAI fallback frequency
- Total AI request count
- Average response times

## Configuration Scenarios

### Scenario 1: Gemini Only (Default)
```bash
GEMINI_API_KEY=your_key_here
# OPENAI_API_KEY not set
```
- Uses Gemini for all AI operations
- Falls back to basic analysis if Gemini fails
- Lower cost, but less reliability

### Scenario 2: Gemini + OpenAI Fallback (Recommended)
```bash
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
```
- Uses Gemini as primary
- Automatically falls back to OpenAI on errors
- Higher reliability, slightly higher cost
- **Best for production environments**

### Scenario 3: OpenAI Only
```bash
# GEMINI_API_KEY not set
OPENAI_API_KEY=your_openai_key
```
- Uses OpenAI for all AI operations
- No fallback to Gemini
- Higher cost, but consistent performance

### Scenario 4: No AI (Development/Testing)
```bash
# Neither key set
```
- Returns basic metric-based analysis
- No AI-powered insights
- Useful for testing non-AI features

## Testing the Fallback

### Test Gemini Failure
```bash
# Temporarily set invalid Gemini key
GEMINI_API_KEY=invalid_key
OPENAI_API_KEY=your_valid_openai_key

# Analyze a repository - should use OpenAI fallback
```

### Test Both Providers
```bash
# Set both valid keys
GEMINI_API_KEY=your_valid_gemini_key
OPENAI_API_KEY=your_valid_openai_key

# Monitor logs to see which provider is used
```

## Troubleshooting

### Issue: Both AI providers failing
**Solution**: 
- Check API keys are valid
- Verify network connectivity
- Check rate limits on both platforms
- Review error logs for specific issues

### Issue: High OpenAI costs
**Solution**:
- Ensure Gemini key is valid and working
- Check Gemini rate limits aren't being exceeded
- Enable caching to reduce API calls
- Consider upgrading Gemini tier

### Issue: Slow response times
**Solution**:
- Enable Redis caching for faster responses
- Increase rate limits if being throttled
- Consider adjusting model parameters for faster responses if needed

## Best Practices

1. **Always Configure Both Keys**: For production, always set both API keys
2. **Monitor Costs**: Track API usage on both platforms
3. **Enable Caching**: Reduce API calls with intelligent caching
4. **Set Appropriate Timeouts**: Configure reasonable timeout values
5. **Log Fallback Events**: Monitor when fallbacks occur to identify issues
6. **Test Regularly**: Periodically test both providers work correctly

## Future Enhancements

Planned improvements to the AI fallback system:
- Support for additional AI providers (Anthropic Claude, etc.)
- Intelligent provider selection based on request type
- Cost optimization algorithms
- Automatic provider health checking
- Load balancing across multiple providers

## Related Documentation

- [Performance Configuration](./PERFORMANCE_CONFIGURATION.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Production Deployment Checklist](../PRODUCTION_DEPLOYMENT_CHECKLIST.md)
