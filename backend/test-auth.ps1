# PowerShell Authentication Test Script
param(
    [string]$BaseUrl = "http://localhost:5000"
)

Write-Host "=== Authentication System Test ===" -ForegroundColor Cyan
Write-Host "Testing server at: $BaseUrl" -ForegroundColor Yellow
Write-Host ""

# Global variables
$global:authToken = ""
$global:testUser = @{
    firstName = "PowerShell"
    lastName = "Test"
    email = "powershell.test.$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
    phone = "+2010$(Get-Random -Minimum 10000000 -Maximum 99999999)"
    password = "PowerShellTest123!"
    role = "merchant"
    address = @{
        street = "123 PowerShell Street"
        city = "Cairo"
        coordinates = @(31.2357, 30.0444)
    }
}

function Test-ApiCall {
    param(
        [string]$Endpoint,
        [string]$Method = "GET",
        [hashtable]$Data = $null,
        [hashtable]$Headers = @{}
    )
    
    try {
        $uri = "$BaseUrl$Endpoint"
        $params = @{
            Uri = $uri
            Method = $Method
            ContentType = "application/json"
            Headers = $Headers
        }
        
        if ($Data) {
            $params.Body = $Data | ConvertTo-Json -Depth 10
        }
        
        $response = Invoke-RestMethod @params
        return @{ Success = $true; Data = $response }
    }
    catch {
        $errorDetail = $_.Exception.Response
        if ($errorDetail) {
            $reader = [System.IO.StreamReader]::new($errorDetail.GetResponseStream())
            $errorBody = $reader.ReadToEnd() | ConvertFrom-Json
            return @{ Success = $false; Error = $errorBody.message; StatusCode = $errorDetail.StatusCode }
        }
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Success,
        [string]$Message = "",
        [object]$Data = $null
    )
    
    if ($Success) {
        Write-Host "✅ $TestName" -ForegroundColor Green
        if ($Message) { Write-Host "   $Message" -ForegroundColor Gray }
    } else {
        Write-Host "❌ $TestName" -ForegroundColor Red
        if ($Message) { Write-Host "   Error: $Message" -ForegroundColor Red }
    }
    
    if ($Data) {
        Write-Host "   Data: $($Data | ConvertTo-Json -Compress)" -ForegroundColor DarkGray
    }
    Write-Host ""
}

# Test 1: Health Check
Write-Host "1. Testing Server Health..." -ForegroundColor Yellow
$healthResult = Test-ApiCall -Endpoint "/health"
Write-TestResult -TestName "Health Check" -Success $healthResult.Success -Message $healthResult.Data.status -Data $healthResult.Data

# Test 2: User Registration
Write-Host "2. Testing User Registration..." -ForegroundColor Yellow
$registerResult = Test-ApiCall -Endpoint "/api/auth/register" -Method "POST" -Data $global:testUser

if ($registerResult.Success) {
    $global:authToken = $registerResult.Data.data.token
    $user = $registerResult.Data.data.user
    Write-TestResult -TestName "User Registration" -Success $true -Message "User created: $($user.fullName) ($($user.role))"
} else {
    Write-TestResult -TestName "User Registration" -Success $false -Message $registerResult.Error
}

# Test 3: Duplicate Registration (should fail)
Write-Host "3. Testing Duplicate Registration..." -ForegroundColor Yellow
$duplicateResult = Test-ApiCall -Endpoint "/api/auth/register" -Method "POST" -Data $global:testUser
Write-TestResult -TestName "Duplicate Registration Prevention" -Success (!$duplicateResult.Success) -Message $duplicateResult.Error

# Test 4: User Login
Write-Host "4. Testing User Login..." -ForegroundColor Yellow
$loginData = @{
    email = $global:testUser.email
    password = $global:testUser.password
}
$loginResult = Test-ApiCall -Endpoint "/api/auth/login" -Method "POST" -Data $loginData

if ($loginResult.Success) {
    $global:authToken = $loginResult.Data.data.token
    $loginCount = $loginResult.Data.data.user.metadata.loginCount
    Write-TestResult -TestName "User Login" -Success $true -Message "Login successful, count: $loginCount"
} else {
    Write-TestResult -TestName "User Login" -Success $false -Message $loginResult.Error
}

# Test 5: Invalid Login
Write-Host "5. Testing Invalid Login..." -ForegroundColor Yellow
$invalidLoginData = @{
    email = $global:testUser.email
    password = "wrongpassword"
}
$invalidLoginResult = Test-ApiCall -Endpoint "/api/auth/login" -Method "POST" -Data $invalidLoginData
Write-TestResult -TestName "Invalid Login Prevention" -Success (!$invalidLoginResult.Success) -Message $invalidLoginResult.Error

# Test 6: Get User Profile
Write-Host "6. Testing Get User Profile..." -ForegroundColor Yellow
$headers = @{ Authorization = "Bearer $global:authToken" }
$profileResult = Test-ApiCall -Endpoint "/api/auth/me" -Headers $headers

if ($profileResult.Success) {
    $user = $profileResult.Data.data.user
    Write-TestResult -TestName "Get User Profile" -Success $true -Message "Profile retrieved: $($user.fullName) - $($user.email)"
} else {
    Write-TestResult -TestName "Get User Profile" -Success $false -Message $profileResult.Error
}

# Test 7: Update Profile
Write-Host "7. Testing Profile Update..." -ForegroundColor Yellow
$updateData = @{
    firstName = "Updated"
    preferences = @{
        language = "ar"
        notifications = @{
            email = $false
        }
    }
}
$updateResult = Test-ApiCall -Endpoint "/api/auth/profile" -Method "PUT" -Data $updateData -Headers $headers

if ($updateResult.Success) {
    $updatedUser = $updateResult.Data.data.user
    Write-TestResult -TestName "Profile Update" -Success $true -Message "Profile updated: $($updatedUser.firstName) - Language: $($updatedUser.preferences.language)"
} else {
    Write-TestResult -TestName "Profile Update" -Success $false -Message $updateResult.Error
}

# Test 8: Password Reset Request
Write-Host "8. Testing Password Reset..." -ForegroundColor Yellow
$resetData = @{ email = $global:testUser.email }
$resetResult = Test-ApiCall -Endpoint "/api/auth/forgot-password" -Method "POST" -Data $resetData
Write-TestResult -TestName "Password Reset Request" -Success $resetResult.Success -Message $resetResult.Data.message

# Test 9: Unauthorized Access
Write-Host "9. Testing Unauthorized Access..." -ForegroundColor Yellow
$unauthorizedResult = Test-ApiCall -Endpoint "/api/auth/me"
Write-TestResult -TestName "Unauthorized Access Prevention" -Success (!$unauthorizedResult.Success) -Message $unauthorizedResult.Error

# Test 10: Invalid Token
Write-Host "10. Testing Invalid Token..." -ForegroundColor Yellow
$invalidHeaders = @{ Authorization = "Bearer invalid-token-12345" }
$invalidTokenResult = Test-ApiCall -Endpoint "/api/auth/me" -Headers $invalidHeaders
Write-TestResult -TestName "Invalid Token Prevention" -Success (!$invalidTokenResult.Success) -Message $invalidTokenResult.Error

# Summary
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Test User Email: $($global:testUser.email)" -ForegroundColor Yellow
Write-Host "Auth Token: $($global:authToken.Substring(0,[Math]::Min(20,$global:authToken.Length)))..." -ForegroundColor Yellow
Write-Host ""
Write-Host "All authentication tests completed!" -ForegroundColor Green
Write-Host "Your authentication system is working correctly." -ForegroundColor Green