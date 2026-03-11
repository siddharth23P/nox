fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .build_server(true)
        .compile_protos(
            &["../../shared/proto/auth/v1/auth.proto"],
            &["../../shared/proto"],
        )?;
    Ok(())
}
