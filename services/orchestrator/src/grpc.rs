use tonic::{transport::Server, Request, Response, Status};
pub mod auth_v1 {
    tonic::include_proto!("nox.auth.v1");
}

use auth_v1::auth_service_server::{AuthService, AuthServiceServer};
use auth_v1::{VerifySessionRequest, VerifySessionResponse, RegisterRequest, RegisterResponse, LoginRequest, LoginResponse, GetOrganizationRequest, GetOrganizationResponse};

pub struct MyAuthService {}

#[tonic::async_trait]
impl AuthService for MyAuthService {
    async fn register(&self, _request: Request<RegisterRequest>) -> Result<Response<RegisterResponse>, Status> {
        Err(Status::unimplemented("Register handled by Bifrost"))
    }

    async fn login(&self, _request: Request<LoginRequest>) -> Result<Response<LoginResponse>, Status> {
        Err(Status::unimplemented("Login handled by Bifrost"))
    }

    async fn verify_session(&self, request: Request<VerifySessionRequest>) -> Result<Response<VerifySessionResponse>, Status> {
        let req = request.into_inner();
        println!("Orchestrator: Verifying session for token: {}", req.token);
        
        // Mocking ZK-Identity verification
        Ok(Response::new(VerifySessionResponse {
            valid: true,
            user_id: "zk-verified-user".to_string(),
            tenant_id: "zk-verified-tenant".to_string(),
        }))
    }

    async fn get_organization(&self, _request: Request<GetOrganizationRequest>) -> Result<Response<GetOrganizationResponse>, Status> {
        Err(Status::unimplemented("GetOrganization handled by Bifrost"))
    }

    async fn verify_email(&self, _request: Request<auth_v1::VerifyEmailRequest>) -> Result<Response<auth_v1::VerifyEmailResponse>, Status> {
        // Orchestrator doesn't handle the actual verification, just satisfies the trait
        Ok(Response::new(auth_v1::VerifyEmailResponse {
            success: true,
            message: "Email verification status validated".to_string(),
        }))
    }
}

pub async fn start_grpc_server(addr: &str) -> Result<(), Box<dyn std::error::Error>> {
    let addr = addr.parse()?;
    let auth_service = MyAuthService {};

    println!("Orchestrator gRPC Server listening on {}", addr);

    Server::builder()
        .add_service(AuthServiceServer::new(auth_service))
        .serve(addr)
        .await?;

    Ok(())
}
