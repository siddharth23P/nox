mod auth;
mod grpc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Project Nox: Rust Orchestrator Operational");
    
    // Start gRPC server in a separate task or as the main loop
    grpc::start_grpc_server("0.0.0.0:50052").await?;
    
    Ok(())
}
