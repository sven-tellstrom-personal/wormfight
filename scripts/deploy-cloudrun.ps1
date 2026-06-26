# Deploy Wormfight to Google Cloud Run (GCP project: wormfight-2fac5)
# Requires: gcloud CLI, billing enabled on the project
# Usage: .\scripts\deploy-cloudrun.ps1

$ErrorActionPreference = "Stop"

$PROJECT = "wormfight-2fac5"
$REGION = "europe-west1"
$SERVICE = "wormfight"
$Root = Split-Path -Parent $PSScriptRoot

Set-Location $Root

Write-Host "Deploying from $Root"
Write-Host "Setting project to $PROJECT..."
gcloud config set project $PROJECT

Write-Host "Enabling required APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

Write-Host "Deploying to Cloud Run (this may take a few minutes)..."
gcloud run deploy $SERVICE `
  --source . `
  --region $REGION `
  --allow-unauthenticated `
  --port 8080 `
  --project $PROJECT

Write-Host ""
Write-Host "Live game URL:"
gcloud run services describe $SERVICE --region $REGION --format="value(status.url)"
