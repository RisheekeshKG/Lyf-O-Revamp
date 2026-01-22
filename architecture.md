# Project Architecture

This document describes the high-level architecture of the application.

## Overview

The application is a desktop productivity tool that uses AI to generate and manage templates (To-Do lists, Tables, Habits, Journals). It consists of an Electron-based frontend and a Python FastAPI backend.

## Components

1.  **Frontend (Electron + React)**:
    -   Provides the user interface.
    -   Manages local file operations (Read/Write JSON) via Electron IPC.
    -   Communicates with the backend for AI chat and recommendations.

2.  **Backend (FastAPI)**:
    -   Exposes REST endpoints for Chat and Recommendations.
    -   **LLM Integration**: Uses Google Gemini (via LangChain) for natural language processing and content generation.
    -   **ML Model**: Uses a K-Prototypes model to cluster users and recommend templates based on profiles.
    -   **Tooling**: Can directly create and update user files (JSON) based on chat instructions.

3.  **Data Storage**:
    -   **User Data**: Stored as JSON files in the `frontend/data/` directory.
    -   **ML Artifacts**: `clustered.csv` (User clusters) and `kproto_model.pkl` (Model) stored in the backend directory.

## Architecture Diagram

```mermaid
graph TD
    User((User))

    subgraph Client [Frontend (Electron / React)]
        UI[User Interface]
        IPC[Electron IPC Main Process]
        Store[Local File Storage]
    end

    subgraph Server [Backend (FastAPI)]
        API[API Endpoints]
        Agent[LangChain Agent]
        ML[K-Prototypes Model]
    end

    subgraph External [External Services]
        Gemini[Google Gemini API]
    end

    %% User Interaction
    User <--> UI

    %% Frontend Internal
    UI <--> IPC
    IPC <-->|Read/Write JSON| Store

    %% Frontend <-> Backend
    UI --HTTP Requests--> API

    %% Backend Internal
    API <--> Agent
    API <--> ML

    %% Backend External
    Agent <-->|API Calls| Gemini

    %% Backend <-> Storage
    Agent -->|Create/Update JSON| Store
    ML -.->|Read Training Data| Store
    ML -.->|Read Model| Server
```

## detailed Flow

1.  **Chat & Tool Use**:
    -   User sends a message via UI.
    -   Backend receives message at `/chat/chat`.
    -   Agent decides if a tool (Create/Update File) is needed.
    -   If yes, Agent performs the file operation on `frontend/data` and returns the result.
    -   If no, Agent chats with User via Gemini.

2.  **Recommendation**:
    -   User requests recommendations (or auto-fetch).
    -   Backend `/recommend` endpoint receives User Profile.
    -   ML Model predicts user cluster.
    -   Backend returns recommended templates from similar users.

3.  **File Management**:
    -   User views/edits files in UI.
    -   Electron IPC handles direct file reads/writes to `frontend/data`.
