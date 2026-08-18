/**
 * Contract validator enforcing interfaces defined across Modules 1 to 5.
 * @param {string} schemaType - One of 'candidate_profile', 'jobs', 'ranked_jobs', 'application_package', 'application_status'
 * @param {Object|Array} data - Payload to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateContract(schemaType, data) {
  const errors = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Payload must be a JSON object or array'] };
  }
  
  if (!Array.isArray(data) && !data.schema_version) {
    errors.push('Missing schema_version');
  }

  if (schemaType === 'candidate_profile') {
    const required = [
      'candidate_id', 'candidate_name', 'email', 'experience_years',
      'job_titles', 'preferred_roles', 'technical_skills', 'programming_languages',
      'frameworks', 'tools', 'keywords', 'education', 'extraction_meta'
    ];
    required.forEach(field => {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    });
    if (data.education && !Array.isArray(data.education)) {
      errors.push('education must be an array');
    }
  } 
  
  else if (schemaType === 'jobs') {
    if (!Array.isArray(data)) {
      return { valid: false, errors: ['jobs payload must be an array of job objects'] };
    }
    data.forEach((job, idx) => {
      const required = ['job_id', 'job_title', 'company', 'location', 'source', 'description', 'application_url', 'required_skills', 'retrieved_at'];
      required.forEach(field => {
        if (job[field] === undefined || job[field] === null) {
          errors.push(`Job [index ${idx}]: Missing required field: ${field}`);
        }
      });
    });
  } 
  
  else if (schemaType === 'ranked_jobs') {
    if (!Array.isArray(data)) {
      return { valid: false, errors: ['ranked_jobs payload must be an array'] };
    }
    data.forEach((job, idx) => {
      const required = ['job_id', 'job_title', 'company', 'application_url', 'match_score', 'score_breakdown', 'matched_skills', 'missing_skills', 'experience_match', 'semantic_similarity', 'decision', 'explanation', 'method', 'ranked_at'];
      required.forEach(field => {
        if (job[field] === undefined || job[field] === null) {
          errors.push(`Ranked Job [index ${idx}]: Missing required field: ${field}`);
        }
      });
    });
  }

  else if (schemaType === 'application_package') {
    const required = ['candidate_id', 'candidate_email', 'job_id', 'job_title', 'company', 'application_url', 'match_score', 'cv_file', 'cv_tex_file', 'cover_letter_file', 'tailoring_meta', 'fact_check', 'latex_compiled'];
    required.forEach(field => {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    });
  }

  else if (schemaType === 'application_status') {
    const required = ['application_id', 'candidate_id', 'job_id', 'company', 'job_title', 'approval_decision', 'application_status', 'submission_method', 'attempts', 'confirmation_sent'];
    required.forEach(field => {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateContract
};
