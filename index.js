import fsPromises from 'fs/promises'
import path from 'path'
import process from 'process'

import got from 'got'
import * as R from 'ramda'

const args = R.drop(2, process.argv)

const argsNotOk = R.compose(
  R.not,
  R.either(R.equals(2), R.equals(3)),
  R.length
)(args)

if (argsNotOk) {
  console.log('usage: node index.js <api-key> <album-id> <output-path>')
  process.exit(0)
}

const apiKey = args[0]
const albumId = args[1]
const outputPath = R.defaultTo(path.resolve(), args[2])

const extractImageDescriptors = R.path(['data', 'images'])
const simplifyImageDescriptors = R.map(R.pick(['id', 'link', 'type']))

// prettier-ignore
const cleanType =
  R.map(
    R.over(
      R.lensProp('type'),
      R.compose(R.last, R.split('/'))
    )
  )

// prettier-ignore
const addNumber =
  R.compose(
    R.map(R.apply(R.merge)),
    R.chain(
      R.zip,
      R.compose(
        R.map(R.objOf('no')),
        R.range(1),
        R.add(1),
        R.length
      )
    )
  )

// prettier-ignore
const addOutputPath =
  R.map(
    R.compose(
      R.over(
        R.lensProp('outputPath'),
        relPath => path.join(outputPath, relPath)
      ),
      R.chain(
        R.set(R.lensProp('outputPath')),
        ({id, no, type}) => `${no}-${id}.${type}`
      )
    )
  )

// prettier-ignore
const fetchImage =
  R.compose(
    R.bind(Promise.all, Promise),
    R.map(
      R.compose(
        R.andThen(
          R.over(
            R.lensProp('image'),
            R.prop('rawBody')
          )
        ),
        async ob => ({...ob, image: await ob.image}),
      )
    ),
    R.map(
      R.chain(
        R.set(R.lensProp('image')),
        R.compose(
          got,
          R.prop('link')
        )
      )
    )
  )

// prettier-ignore
const writeImage =
  R.compose(
    R.bind(Promise.all, Promise),
    R.map(
      R.compose(
        R.apply(fsPromises.writeFile),
        R.props(['outputPath', 'image'])
      )
    ),
  )

// prettier-ignore
const routine =
  R.compose(
    R.andThen(writeImage),
    fetchImage,
    addOutputPath,
    addNumber,
    cleanType,
    simplifyImageDescriptors,
    extractImageDescriptors
  )

// prettier-ignore
await R.andThen(
    routine
  )(
    got(
      `https://api.imgur.com/3/album/${albumId}`, {
        headers: { Authorization: `Client-ID ${apiKey}` },
    }).json()
  )
