use axum::{
    Json, Router,
    extract::DefaultBodyLimit,
    routing::{get, post},
};
use biteos_recommender::{Request, Response, recommend};

async fn recommendations(Json(req): Json<Request>) -> Json<Response> {
    Json(recommend(&req))
}

#[tokio::main]
async fn main() {
    let addr = std::env::var("ENGINE_ADDR").unwrap_or_else(|_| "127.0.0.1:8091".into());
    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/recommend", post(recommendations))
        .layer(DefaultBodyLimit::max(65_536));
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("bind recommender");
    println!("BiteOS recommendation engine listening on {addr}");
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .expect("serve recommender");
}
