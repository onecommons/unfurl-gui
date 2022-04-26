import express from 'express'
import {getProjectPaths} from '../utils/iterate_projects'

const router = express.Router()

router.get('/project-paths', (req, res) => {
  res.send({
    // better to use this from vue_config?
    projectPaths: getProjectPaths()
  })

})


export default router
