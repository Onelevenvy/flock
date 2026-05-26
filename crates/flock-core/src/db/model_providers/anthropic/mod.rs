use crate::db::ModelProvider;
use crate::db::modelprovider_seed::{parse_provider_from_yaml, ModelSeed};

pub fn seed_data() -> (ModelProvider, Vec<ModelSeed>) {
    parse_provider_from_yaml(
        include_str!("provider.yaml"),
        Some(include_str!("icon.svg")),
    )
}
