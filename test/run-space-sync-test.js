import test from 'tape'
import sinon from 'sinon'
import Promise from 'bluebird'

import runSpaceSync from '../lib/run-space-sync'
import errorBuffer from '../lib/error-buffer'

const sourceResponse = {
  nextSyncToken: 'nextsynctoken',
  contentTypes: [
    {original: {sys: {id: 'exists'}}}
  ],
  locales: [{original: {code: 'en-US'}}]
}
const destinationResponse = {
  contentTypes: [
    {sys: {id: 'exists'}},
    {sys: {id: 'doesntexist'}}
  ],
  locales: [{code: 'en-US'}, {code: 'en-GB'}]
}

const createClientsStub = sinon.stub().returns({ source: {delivery: {}}, destination: {management: {}} })
runSpaceSync.__Rewire__('createClients', createClientsStub)

const getSourceSpaceStub = sinon.stub().returns(Promise.resolve(sourceResponse))
runSpaceSync.__Rewire__('getSourceSpace', getSourceSpaceStub)

const getOutdatedDestinationContentStub = sinon.stub().returns(Promise.resolve(destinationResponse))
runSpaceSync.__Rewire__('getOutdatedDestinationContent', getOutdatedDestinationContentStub)

const transformSpaceStub = sinon.stub().returns(Promise.resolve(sourceResponse))
runSpaceSync.__Rewire__('transformSpace', transformSpaceStub)

const pushToSpaceStub = sinon.stub().returns(Promise.resolve({}))
runSpaceSync.__Rewire__('pushToSpace', pushToSpaceStub)

const fsMock = {
  writeFileSync: sinon.stub()
}
runSpaceSync.__Rewire__('fs', fsMock)

test('Runs space sync', t => {
  const preparedResponses = {
    source: {
      deletedContentTypes: [{sys: {id: 'doesntexist'}}],
      deletedLocales: [{code: 'en-GB'}],
      contentTypes: [{original: {sys: {id: 'exists'}}}],
      locales: [{original: {code: 'en-US'}}],
      nextSyncToken: 'nextsynctoken'
    },
    destination: Object.assign({}, destinationResponse)
  }

  errorBuffer.push({
    request: {
      uri: 'erroruri'
    }
  })

  runSpaceSync({
    opts: {},
    syncTokenFile: 'synctokenfile',
    errorLogFile: 'errorlogfile'
  })
  .then(() => {
    t.ok(createClientsStub.called, 'creates clients')
    t.ok(getSourceSpaceStub.called, 'gets source space')
    t.ok(getOutdatedDestinationContentStub.called, 'gets destination space')
    t.ok(transformSpaceStub.called, 'transforms space')
    t.deepLooseEqual(pushToSpaceStub.args[0][0], preparedResponses, 'pushes to destination space')
    t.ok(fsMock.writeFileSync.calledWith('synctokenfile', 'nextsynctoken'), 'token file created')
    t.ok(fsMock.writeFileSync.calledWith('errorlogfile'), 'error log file created')
    t.ok(/erroruri/.test(fsMock.writeFileSync.secondCall.args[1]), 'error objects are logged')

    runSpaceSync.__ResetDependency__('createClients')
    runSpaceSync.__ResetDependency__('getSourceSpace')
    runSpaceSync.__ResetDependency__('getOutdatedDestinationContent')
    runSpaceSync.__ResetDependency__('transformSpace')
    runSpaceSync.__ResetDependency__('pushToSpace')
    runSpaceSync.__ResetDependency__('fs')
    t.end()
  })
})
