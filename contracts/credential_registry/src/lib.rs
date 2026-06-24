#![no_std]

mod types;

#[cfg(test)]
mod test;

use soroban_sdk::contract;

pub use types::{Error, PublicInputsXdr};

#[contract]
pub struct CredentialRegistry;
