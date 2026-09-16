# Multi-stage production container for .NET 9 Minimal API
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build
WORKDIR /src

# Copy project definition and restore dependencies
COPY AiDocumentWorkflow.Api/AiDocumentWorkflow.Api.csproj AiDocumentWorkflow.Api/
RUN dotnet restore AiDocumentWorkflow.Api/AiDocumentWorkflow.Api.csproj

# Copy source and compile release binary
COPY AiDocumentWorkflow.Api/ AiDocumentWorkflow.Api/
WORKDIR /src/AiDocumentWorkflow.Api
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false --no-restore

# Lightweight, hardened alpine runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine AS final
WORKDIR /app
EXPOSE 5120

ENV ASPNETCORE_URLS=http://+:5120 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1

# Run as non-root user
USER $APP_UID

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "AiDocumentWorkflow.Api.dll"]
