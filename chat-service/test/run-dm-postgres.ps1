param([string]$Container = 'chat-postgres-test')

$ErrorActionPreference = 'Stop'
$containerData = docker inspect $Container | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the PostgreSQL container.' }
if (-not $containerData.State.Running) { throw 'Start the PostgreSQL container first.' }
$settings = @{}
foreach ($entry in $containerData.Config.Env) {
    $pair = $entry.Split('=', 2)
    $settings[$pair[0]] = $pair[1]
}
$adminUser = $settings['POSTGRES_USER']
if (-not $adminUser) { $adminUser = 'postgres' }
$containerIp = ($containerData.NetworkSettings.Networks.PSObject.Properties.Value | Select-Object -First 1).IPAddress
if (-not $containerIp) { throw 'The container needs a bridge network address.' }

# A disposable database/login avoids changing the existing database or password.
$testName = 'dm_test_' + [guid]::NewGuid().ToString('N')
$testPassword = [guid]::NewGuid().ToString('N')
$previousUrl = $env:TEST_DATABASE_URL
$testExit = 1
$proxyStarted = $false
try {
    # Use a free host port: a Windows PostgreSQL service may already own 5432.
    $forwarder = "const net=require('node:net');net.createServer(s=>{const t=net.connect(5432,process.env.TARGET_HOST);s.pipe(t).pipe(s);s.on('error',()=>t.destroy());t.on('error',()=>s.destroy());}).listen(5432,'0.0.0.0');"
    docker run --detach --rm --name $testName --publish '127.0.0.1::5432' --env "TARGET_HOST=$containerIp" node:24-alpine node -e $forwarder | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not start the temporary TCP forwarder.' }
    $proxyStarted = $true
    $proxyInfo = docker inspect $testName | ConvertFrom-Json
    $hostPort = $proxyInfo.NetworkSettings.Ports.'5432/tcp'[0].HostPort
    "CREATE ROLE $testName LOGIN PASSWORD '$testPassword'; CREATE DATABASE $testName OWNER $testName;" |
        docker exec -i $Container psql -U $adminUser -d postgres -v ON_ERROR_STOP=1 -q
    if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the disposable test database.' }
    $env:TEST_DATABASE_URL = "postgresql://${testName}:${testPassword}@127.0.0.1:${hostPort}/${testName}"
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed; tests were not run.' }
    node --test test/dm.postgres.test.mjs
    $testExit = $LASTEXITCODE
} finally {
    $env:TEST_DATABASE_URL = $previousUrl
    "DROP DATABASE IF EXISTS $testName; DROP ROLE IF EXISTS $testName;" |
        docker exec -i $Container psql -U $adminUser -d postgres -v ON_ERROR_STOP=1 -q
    $cleanupFailed = $LASTEXITCODE -ne 0
    if ($proxyStarted) { docker stop $testName | Out-Null }
    if ($cleanupFailed) { throw "Test database cleanup failed for $testName" }
}
exit $testExit
