
# ERPPLUS - Technology Stack

## Backend Stack

### Core Technologies
- **Language**: Go (Golang)
- **Web Framework**: [Gin](https://gin-gonic.com/) - High-performance HTTP web framework
- **ORM**: [GORM](https://gorm.io/) - Object-relational mapping for Go

### Data & Storage
- **Primary Database**: PostgreSQL - Relational database for transactional data
- **Caching**: Redis - In-memory data store for caching and session management

### API & Communication
- **API Layer**: GraphQL - Query language for API
- **API Gateway**: [Apollo Router](https://www.apollographql.com/docs/router/) - High-performance GraphQL router
- **Inter-Service Communication**:
  - gRPC - For synchronous service-to-service communication
  - [Redpanda](https://redpanda.com/) - Kafka-compatible event streaming platform for asynchronous communication

## Frontend Stack

### Web Application
- **Framework**: [Next.js](https://nextjs.org/) - React framework with SSR/SSG capabilities
- **UI Library**: [React](https://react.dev/) - Component-based UI library
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) - Re-usable component library built with Radix UI and Tailwind
- **GraphQL Client**: [urql](https://formidable.com/open-source/urql/) - Lightweight GraphQL client
- **Testing**: [Jest](https://jestjs.io/) - JavaScript testing framework

### Mobile Application
- **Framework**: [React Native](https://reactnative.dev/) - Cross-platform mobile development with React

## Development & Deployment

### Backend Services
- Each microservice built with Go + Gin + GORM
- gRPC for synchronous inter-service calls
- Redpanda for event-driven architecture and async messaging
- Redis for distributed caching and session storage

### Frontend Applications
- **Web**: Next.js with server-side rendering and static generation
- **Mobile**: React Native with shared business logic
- Both consume GraphQL API through Apollo Router gateway
- urql for efficient GraphQL queries and caching

## Key Benefits

1. **Backend**
   - Go provides high performance and efficient concurrency
   - Gin offers fast HTTP routing and middleware support
   - GORM simplifies database operations with type-safe queries
   - Redpanda provides Kafka-compatible streaming with better performance
   - gRPC enables efficient binary protocol for internal services

2. **Frontend**
   - Next.js enables SEO-friendly server-side rendering
   - React Native allows code sharing between web and mobile
   - Tailwind + shadcn provide rapid UI development with consistency
   - urql offers lightweight and performant GraphQL client
   - Jest ensures robust testing coverage

3. **Overall Architecture**
   - Apollo Router provides unified GraphQL gateway across services
   - Event streaming with Redpanda enables scalable async patterns
   - Redis caching improves response times and reduces database load
   - Microservices architecture allows independent scaling and deployment
