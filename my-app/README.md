# Fluke Games Digital Studio Platform

This README highlights the core platform architecture behind the Fluke Games web experience. The diagrams frame the project as a connected digital studio platform: public discovery, careers, customer access, operations, agentic AI, and governance.

## Platform Overview

![Fluke Games Digital Studio Platform Overview](public/architecture/0.Cover.png)

## Core Feature Pipelines

### 1. Public Website Experience Pipeline

![Public Website Experience Pipeline](public/architecture/1.Public.png)

### 2. Careers & Talent Pipeline

![Careers and Talent Pipeline](public/architecture/2.Careers.png)

### 3. Customer Portal Pipeline

![Customer Portal Pipeline](public/architecture/3.Customer.png)

### 4. Studio Operations Pipeline

![Studio Operations Pipeline](public/architecture/4.Operations.png)

### 5. Agentic AI Pipeline

![Agentic AI Pipeline](public/architecture/5.AgenticAI.png)

### 6. Integration & Governance Pipeline

![Integration and Governance Pipeline](public/architecture/6.Governance.png)

### 7. AWS Deployment + Platform Architecture

![AWS Deployment and Platform Architecture](public/architecture/7.AWSDeployment.png)

## Technology Lens

The platform is designed around a few connected capabilities:

- Public website experiences for games, services, portfolio, team visibility, devlogs, and contact flows.
- Careers and talent workflows that turn public interest into structured applicant data.
- Customer portal access for signup, authentication, entitlements, and protected downloads.
- Studio operations flows for projects, updates, timelogs, analytics, and recognition.
- Agentic AI workflows using routed context, memory, tool actions, and approval guardrails.
- Governance and integrations across endpoint policies, RBAC, audit logs, AWS services, and third-party systems.
- AWS deployment architecture using Lambda, API Gateway, DynamoDB, S3, SQS, SES, Secrets Manager, CloudWatch, IAM/OIDC, and GitHub Actions.

## Local Development

```bash
npm install
npm run dev
```
