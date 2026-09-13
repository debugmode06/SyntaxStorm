# 🏆 CodeArena

> A modern, scalable full-stack coding contest platform designed to conduct programming competitions with automated code evaluation, contest management, submissions, rankings, and performance analytics.

---

## 🚀 Overview

**CodeArena** is a full-stack competitive programming platform that enables organizers to create and manage coding contests while providing participants with a seamless environment to solve programming problems, submit solutions, and track their performance.

The platform is designed with scalability, reliability, and a clean user experience in mind.

### ✨ Key Capabilities

* 🏆 Create and manage coding contests
* 👨‍💻 Interactive online coding environment
* ⚡ Automated code execution and evaluation
* 📝 Problem and test-case management
* 📤 Code submission and submission history
* 📊 Real-time leaderboard
* 👥 Participant management
* ⏱️ Contest countdown and time management
* 📈 Performance and result analytics
* 🔐 Secure authentication and authorization
* 📱 Responsive and modern UI

---

## 🛠️ Tech Stack

### Frontend

* React.js
* JavaScript / TypeScript
* HTML5
* CSS3
* Responsive UI

### Backend

* Node.js
* Express.js
* REST APIs

### Database

* MongoDB
* Mongoose

### Code Evaluation

* Secure code execution environment
* Automated test-case evaluation
* Language-specific execution

### Development Tools

* Git
* GitHub
* npm
* VS Code

---

## 🏗️ System Architecture

```text
                    ┌─────────────────────┐
                    │       Client        │
                    │      React.js       │
                    └──────────┬──────────┘
                               │
                               │ REST API
                               ▼
                    ┌─────────────────────┐
                    │      Backend        │
                    │ Node.js + Express   │
                    └───────┬─────┬───────┘
                            │     │
                 ┌──────────┘     └──────────┐
                 ▼                           ▼
        ┌─────────────────┐        ┌─────────────────┐
        │    MongoDB      │        │ Code Evaluation │
        │   Data Layer    │        │     Engine      │
        └─────────────────┘        └─────────────────┘
```

---

## 👥 User Roles

### 👨‍💼 Admin / Organizer

Organizers can:

* Create contests
* Configure contest duration
* Add and manage coding problems
* Configure test cases
* Manage participants
* Monitor submissions
* View rankings
* Analyze contest performance

### 👨‍💻 Participant

Participants can:

* Register for contests
* View coding problems
* Write and execute code
* Submit solutions
* View submission results
* Track remaining contest time
* View leaderboard
* Analyze their performance

---

## 🎯 Core Features

### 1. Contest Management

Organizers can create and configure contests with:

* Contest title
* Description
* Start date and time
* End date and time
* Duration
* Problems
* Participant limits
* Contest status

Contest states include:

```text
Upcoming → Live → Completed
```

---

### 2. Problem Management

Each coding problem can contain:

* Problem title
* Problem statement
* Input format
* Output format
* Constraints
* Sample input
* Sample output
* Difficulty level
* Test cases
* Expected output

Problems can be categorized as:

* 🟢 Easy
* 🟡 Medium
* 🔴 Hard

---

### 3. Online Code Editor

Participants get an interactive coding environment where they can:

* Select programming language
* Write code
* Run code
* Test sample inputs
* Submit solutions
* View execution results

Example supported languages:

```text
JavaScript
Python
Java
C
C++
```

---

### 4. Automated Evaluation

Submitted solutions are evaluated against predefined test cases.

```text
                Code Submission
                       │
                       ▼
                Syntax Validation
                       │
                       ▼
                 Code Execution
                       │
                       ▼
                  Test Cases
                       │
                       ▼
              Result Calculation
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
       Accepted                  Rejected
```

Possible results:

* ✅ Accepted
* ❌ Wrong Answer
* ⏱️ Time Limit Exceeded
* 💾 Memory Limit Exceeded
* ⚠️ Runtime Error
* 🔧 Compilation Error

---

## 🏆 Leaderboard

The leaderboard ranks participants based on contest performance.

Typical ranking factors include:

1. Number of problems solved
2. Score obtained
3. Submission penalties
4. Time taken

Example:

| Rank | Participant   | Solved | Score |
| ---- | ------------- | ------ | ----- |
| 1    | Participant A | 5      | 500   |
| 2    | Participant B | 4      | 420   |
| 3    | Participant C | 4      | 390   |

---

## 📊 Performance Analytics

The platform can provide insights such as:

* Problems attempted
* Problems solved
* Accuracy
* Total submissions
* Accepted submissions
* Failed submissions
* Execution time
* Contest score
* Rank

This allows participants and organizers to understand contest performance.

---

## 🔐 Authentication & Security

The platform uses authentication and authorization to protect user accounts and contest resources.

Security considerations include:

* Password hashing
* JWT-based authentication
* Role-based authorization
* Protected API routes
* Input validation
* Secure code execution
* API error handling
* Rate limiting
* Submission validation

> Code execution should always be isolated from the main backend to prevent submitted code from accessing the host system or sensitive resources.

---

## 📁 Project Structure

```text
CodeArena/
│
├── client/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── layouts/
│       ├── services/
│       ├── hooks/
│       ├── utils/
│       └── App.jsx
│
├── server/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── server.js
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## ⚙️ Installation

### Prerequisites

Make sure the following are installed:

* Node.js
* npm
* MongoDB
* Git

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/codearena.git
```

### 2. Navigate to the Project

```bash
cd codearena
```

### 3. Install Dependencies

```bash
npm install
```

If frontend and backend have separate dependencies:

```bash
cd client
npm install

cd ../server
npm install
```

---

## 🔑 Environment Variables

Create a `.env` file inside the backend directory.

Example:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:5173
```

> Never commit your `.env` file or other secrets to GitHub.

---

## ▶️ Running the Application

### Start Backend

```bash
cd server
npm run dev
```

### Start Frontend

```bash
cd client
npm run dev
```

The application will be available at:

```text
http://localhost:5173
```

---

## 🔄 Application Flow

```text
User Registration
       │
       ▼
Authentication
       │
       ▼
Contest Selection
       │
       ▼
Contest Registration
       │
       ▼
Contest Starts
       │
       ▼
Select Problem
       │
       ▼
Write Code
       │
       ▼
Run / Submit
       │
       ▼
Automated Evaluation
       │
       ▼
Score Updated
       │
       ▼
Leaderboard Updated
```

---

## 🧪 Testing

Run the test suite using:

```bash
npm test
```

For backend testing:

```bash
cd server
npm test
```

For frontend testing:

```bash
cd client
npm test
```

---

## 📈 Scalability

The architecture is designed to support future expansion.

Potential improvements include:

* Redis caching
* WebSocket-based real-time updates
* Background job queues
* Docker-based isolated code execution
* Horizontal backend scaling
* Load balancing
* CDN integration
* Database indexing
* Contest-level caching
* Microservice-based evaluation infrastructure

A scalable evaluation architecture can follow:

```text
                    API Server
                        │
                        ▼
                  Submission Queue
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
      Worker 1      Worker 2      Worker 3
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                 Result Processor
                        │
                        ▼
                    Database
                        │
                        ▼
                   Leaderboard
```

---

## 🗺️ Future Roadmap

* [ ] Multi-language code execution
* [ ] Real-time leaderboard
* [ ] Contest announcements
* [ ] Private contests
* [ ] Team-based contests
* [ ] Problem discussion system
* [ ] Advanced analytics dashboard
* [ ] Rating and ranking system
* [ ] User profiles
* [ ] Achievement badges
* [ ] Contest history
* [ ] AI-powered problem recommendations
* [ ] Plagiarism detection
* [ ] Docker-based secure execution
* [ ] WebSocket live updates

---

## 🤝 Contributing

Contributions are welcome!

### Steps

1. Fork the repository
2. Create a new branch

```bash
git checkout -b feature/your-feature
```

3. Make your changes
4. Commit your changes

```bash
git commit -m "feat: add your feature"
```

5. Push the branch

```bash
git push origin feature/your-feature
```

6. Open a Pull Request

---

## 📌 Git Commit Convention

Recommended commit prefixes:

```text
feat:     New feature
fix:      Bug fix
docs:     Documentation
style:    UI / formatting changes
refactor: Code restructuring
test:     Testing
chore:    Maintenance
```

Example:

```bash
git commit -m "feat: add contest leaderboard"
```

---

## 🔒 Security

If you discover a security vulnerability, please do not create a public GitHub issue containing sensitive details.

Instead, contact the project maintainers privately.

---

## 📄 License

This project is licensed under the MIT License.

See the `LICENSE` file for more information.

---

## 👨‍💻 Team

**CodeArena** is developed as a collaborative full-stack software project focused on building a reliable and scalable competitive programming experience.

---

## ⭐ Support

If you find this project useful, consider giving the repository a ⭐ on GitHub.

---

<p align="center">
  Built with ❤️ using React, Node.js, Express and MongoDB
</p>
