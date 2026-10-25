const messages = Object.freeze({
  SAFETY_BLOCK:
    'We could not build a mystery from that idea. Try a different, less graphic scenario.',
  CASE_VALIDATION_FAILED:
    'The generated clues did not pass the fairness checks. Please retry this case.',
  IMMUTABLE_PLAN_INVALID:
    'The generated timeline or solution plan could not be validated. Please retry this case.',
  PROVIDER_TIMEOUT: 'The AI service took too long to respond. Please try again.',
  PROVIDER_RATE_LIMIT:
    'The AI service request limit was reached. Check the connected account’s quota before retrying.',
  PROVIDER_REQUEST_REJECTED:
    'The AI service rejected the generation request. The generator configuration needs attention before retrying.',
  PROVIDER_AUTH_ERROR:
    'The AI service could not authenticate this request. Check the configured API key and permissions.',
  PROVIDER_MODEL_UNAVAILABLE:
    'The configured AI model is unavailable. Choose an accessible model before retrying.',
  INVALID_AI_JSON: 'The AI service returned an unreadable case. Please retry this case.',
  INVALID_AI_SCHEMA:
    'The generated case did not match the required format. Please retry this case.',
  ASSET_FAILED: 'Required evidence images could not be created. Please try again.',
  ASSET_QUOTA_EXCEEDED:
    'Image generation is blocked by your AI provider’s quota. Enable image access or increase the quota before retrying.',
});
export function publicGenerationError(code) {
  return {
    errorCode: Object.hasOwn(messages, code) ? code : 'GENERATION_FAILED',
    safeErrorMessage: Object.hasOwn(messages, code)
      ? messages[code]
      : 'We could not complete this case. Please try again.',
  };
}
