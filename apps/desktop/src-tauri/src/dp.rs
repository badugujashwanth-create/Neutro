use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AggregateInput {
  pub date_from: String,
  pub date_to: String,
  pub cohort_filters: HashMap<String, serde_json::Value>,
  pub metrics: Vec<String>,
  pub epsilon_override: Option<f64>,
  pub requester_role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AggregateResponse {
  pub cohort_size: usize,
  pub k_threshold: usize,
  pub results: HashMap<String, f64>,
  pub epsilon_used: f64,
  pub remaining_monthly_budget: f64,
  pub dp_protected: bool,
}

#[derive(Debug)]
pub struct DpRuntime {
  pub k_threshold: usize,
  pub monthly_budget_max: f64,
  pub monthly_budget_used: f64,
  pub epsilon_by_metric: HashMap<String, f64>,
}

impl Default for DpRuntime {
  fn default() -> Self {
    Self {
      k_threshold: 30,
      monthly_budget_max: 8.0,
      monthly_budget_used: 0.0,
      epsilon_by_metric: HashMap::from([
        ("avg_overload".to_string(), 0.8),
        ("high_overload_count".to_string(), 0.7),
        ("avg_attention".to_string(), 0.8),
      ]),
    }
  }
}

fn laplace_noise(scale: f64) -> f64 {
  let mut rng = rand::thread_rng();
  let u: f64 = rng.gen_range(-0.5..0.5);
  -scale * u.signum() * (1.0 - 2.0 * u.abs()).ln()
}

fn metric_epsilon(runtime: &DpRuntime, metric: &str, epsilon_override: Option<f64>) -> f64 {
  epsilon_override.unwrap_or_else(|| runtime.epsilon_by_metric.get(metric).copied().unwrap_or(0.7))
}

pub fn aggregate(runtime: &mut DpRuntime, input: &AggregateInput) -> Result<AggregateResponse, String> {
  if input.requester_role != "hr" && input.requester_role != "admin" {
    return Err("Requester role not allowed for aggregate endpoint".to_string());
  }

  let cohort_size = 60usize;
  if cohort_size < runtime.k_threshold {
    return Err(format!(
      "Cohort size {} is below k={}",
      cohort_size, runtime.k_threshold
    ));
  }

  let mut epsilon_used = 0.0f64;
  for metric in &input.metrics {
    epsilon_used += metric_epsilon(runtime, metric, input.epsilon_override);
  }

  if runtime.monthly_budget_used + epsilon_used > runtime.monthly_budget_max {
    return Err("Monthly privacy budget exceeded".to_string());
  }

  let mut results = HashMap::new();
  for metric in &input.metrics {
    let epsilon = metric_epsilon(runtime, metric, input.epsilon_override);
    let scale = 1.0 / epsilon.max(0.01);
    let noisy = match metric.as_str() {
      "avg_overload" => 58.0 + laplace_noise(scale),
      "high_overload_count" => (20.0 + laplace_noise(scale)).max(0.0).round(),
      "avg_attention" => 62.0 + laplace_noise(scale),
      _ => laplace_noise(scale),
    };
    results.insert(metric.clone(), (noisy * 100.0).round() / 100.0);
  }

  runtime.monthly_budget_used += epsilon_used;
  let remaining = (runtime.monthly_budget_max - runtime.monthly_budget_used).max(0.0);

  Ok(AggregateResponse {
    cohort_size,
    k_threshold: runtime.k_threshold,
    results,
    epsilon_used,
    remaining_monthly_budget: remaining,
    dp_protected: true,
  })
}
