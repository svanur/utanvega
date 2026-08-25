# Use the official .NET SDK image for building the application
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy the csproj and restore dependencies
COPY ["backend.csproj", "./"]
RUN dotnet restore "./backend.csproj"

# Copy the rest of the source code and build
COPY . .
RUN dotnet build "backend.csproj" -c Release -o /app/build

# Publish the application
FROM build AS publish
RUN dotnet publish "backend.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Final stage: Run the application
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Commit the image was built from, surfaced by the health endpoints so a
# running instance can be tied back to a specific revision. Supplied by CI via
# --build-arg; defaults to "unknown" for local builds.
ARG GIT_HASH=unknown
ENV GIT_HASH=$GIT_HASH

# Expose the port the app listens on
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "Utanvega.Backend.dll"]
