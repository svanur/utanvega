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

# Expose the port the app listens on
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "Utanvega.Backend.dll"]
